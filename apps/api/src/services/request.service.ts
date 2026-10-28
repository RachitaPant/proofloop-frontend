import mongoose from 'mongoose';
import {
  ACTIVE_STATUSES,
  AI_RECOMMENDATION_ACTION,
  nextActiveStage,
  planSkippedSteps,
  stageOf,
  stepsInStage,
  validateFieldValues,
  type ActionableStep,
  type ActionType,
  type AiRecommendation,
  type ChainVerification,
  type CreateRequestInput,
  type Role,
} from '@proofloop/shared';
import { Request, type RequestDoc } from '../models/Request';
import { Workflow, type WorkflowDoc } from '../models/Workflow';
import type { UserDoc } from '../models/User';
import type { DelegationDoc } from '../models/Delegation';
import { ApproverGroup, type ApproverGroupDoc } from '../models/ApproverGroup';
import { BadRequestException, ConflictException, ResourceNotFoundException, ValidationException } from '../utils/errors';
import { GENESIS_HASH, aiDigest, computeHash } from '../utils/hash';
import { activeDelegationsTo } from './delegation.service';

// ---------------------------------------------------------------------------
// Routing state
//
// A workflow's steps are grouped into stages: stages run in order, the steps
// inside a stage run in parallel. `request.currentStep` is the current stage.
// A step is "pending" when it's in the current stage, applies to this request
// (its condition matched at creation) and hasn't reached its approval count.
// The stage completes when no step in it is pending.
// ---------------------------------------------------------------------------

function isActive(request: RequestDoc) {
  return ACTIVE_STATUSES.includes(request.status);
}

/** Principals (users, or delegators when a delegate acted) who approved a step. */
function approversFor(request: RequestDoc, stepIndex: number): string[] {
  return request.stepApprovals.get(String(stepIndex)) ?? [];
}

function isStepComplete(request: RequestDoc, workflow: WorkflowDoc, stepIndex: number) {
  const required = workflow.steps[stepIndex]?.requiredApprovals || 1;
  return approversFor(request, stepIndex).length >= required;
}

/** Applicable, not-yet-complete steps of the current stage. */
function pendingSteps(request: RequestDoc, workflow: WorkflowDoc): number[] {
  if (!isActive(request)) return [];
  return stepsInStage(workflow.steps, request.currentStep).filter(
    (i) => !request.skippedSteps.includes(i) && !isStepComplete(request, workflow, i),
  );
}

// SLA escalation is recorded on the request, never on the shared workflow
// template, so it only reroutes this request's step to ADMIN. Requests
// escalated before per-step escalation existed have `escalated` set but no
// escalatedSteps; that meant "the current step", i.e. the current stage.
function isEscalated(request: RequestDoc, workflow: WorkflowDoc, stepIndex: number) {
  if (request.escalatedSteps.includes(stepIndex)) return true;
  const step = workflow.steps[stepIndex];
  return (
    request.escalated && request.escalatedSteps.length === 0 && !!step && stageOf(step, stepIndex) === request.currentStep
  );
}

/** Who a step is assigned to right now: a role, a group, or ADMIN once escalated. */
export type Assignee = { kind: 'role'; role: Role } | { kind: 'group'; groupId: string };

export function assigneeOf(request: RequestDoc, workflow: WorkflowDoc, stepIndex: number): Assignee {
  const step = workflow.steps[stepIndex]!;
  if (isEscalated(request, workflow, stepIndex)) return { kind: 'role', role: 'ADMIN' };
  if (step.approverGroupId) return { kind: 'group', groupId: step.approverGroupId };
  return { kind: 'role', role: step.requiredRole ?? 'ADMIN' };
}

/** What eligibility checks need besides the request: delegations to the viewer and the groups in play. */
export interface ActorContext {
  delegations: DelegationDoc[];
  groups: Map<string, ApproverGroupDoc>;
}

export async function loadActorContext(user: UserDoc, workflows: (WorkflowDoc | null | undefined)[]): Promise<ActorContext> {
  const groupIds = [
    ...new Set(workflows.flatMap((w) => (w?.steps ?? []).flatMap((s) => (s.approverGroupId ? [s.approverGroupId] : [])))),
  ];
  const [delegations, groups] = await Promise.all([
    activeDelegationsTo(user),
    groupIds.length ? ApproverGroup.find({ _id: { $in: groupIds } }) : Promise.resolve([]),
  ]);
  return { delegations, groups: new Map(groups.map((g) => [g.id as string, g])) };
}

/** Would this principal (a user, or the delegator a delegate stands in for) fill the step's assignment? */
function fills(principal: { id: string; role: Role }, assignee: Assignee, groups: ActorContext['groups']) {
  if (assignee.kind === 'role') return principal.role === assignee.role;
  return groups.get(assignee.groupId)?.memberIds.includes(principal.id) ?? false;
}

// One action per person per stage: parallel steps exist to get independent
// reviews, so nobody signs off on two branches of one stage, whether they
// clicked themselves or a delegate clicked for them.
function involvedInStage(request: RequestDoc, workflow: WorkflowDoc, userId: string) {
  return request.history.some((a) => {
    const step = workflow.steps[a.stepIndex];
    const inStage = !!step && stageOf(step, a.stepIndex) === request.currentStep;
    return inStage && (a.actedBy === userId || a.onBehalfOf === userId);
  });
}

// ---------------------------------------------------------------------------
// Who may act
// ---------------------------------------------------------------------------

/**
 * The capacity in which `user` may act on a pending step, or null.
 * Rules: nobody acts on a request they created, directly or as someone's
 * delegate (and no delegate acts for the request's creator); each person acts
 * at most once per stage; each principal counts at most once toward a step's
 * approval count.
 */
function capacityFor(
  user: UserDoc,
  ctx: ActorContext,
  request: RequestDoc,
  workflow: WorkflowDoc,
  stepIndex: number,
): ActionableStep | null {
  if (request.createdBy === user.id) return null;
  if (involvedInStage(request, workflow, user.id)) return null;

  const assignee = assigneeOf(request, workflow, stepIndex);
  const approvers = approversFor(request, stepIndex);

  if (fills({ id: user.id, role: user.role }, assignee, ctx.groups) && !approvers.includes(user.id)) {
    return { stepIndex, onBehalfOf: null };
  }

  const delegation = ctx.delegations.find(
    (d) =>
      fills({ id: d.fromUserId, role: d.role }, assignee, ctx.groups) &&
      d.fromUserId !== request.createdBy &&
      !approvers.includes(d.fromUserId) &&
      !involvedInStage(request, workflow, d.fromUserId),
  );
  if (delegation) return { stepIndex, onBehalfOf: { id: delegation.fromUserId, name: delegation.fromUserName } };

  return null;
}

function actionableSteps(user: UserDoc, ctx: ActorContext, request: RequestDoc, workflow: WorkflowDoc | null | undefined) {
  if (!workflow) return [];
  return pendingSteps(request, workflow).flatMap((i) => {
    const capacity = capacityFor(user, ctx, request, workflow, i);
    return capacity ? [capacity] : [];
  });
}

// Who may see the request: its creator, admins, anyone who acted on it or had
// someone act on their behalf, and anyone who can act on it now.
function canView(user: UserDoc, request: RequestDoc, actionable: ActionableStep[]) {
  if (user.role === 'ADMIN') return true;
  if (request.createdBy === user.id) return true;
  if (request.history.some((a) => a.actedBy === user.id || a.onBehalfOf === user.id)) return true;
  return actionable.length > 0;
}

async function findWorkflow(id: string) {
  return Workflow.findById(id).catch(() => null);
}

// Loads a request the user is allowed to see. Returns 404 (not 403) for
// requests they can't see, so IDs can't be probed for existence.
async function loadVisibleRequest(user: UserDoc, id: string) {
  const request = await Request.findById(id).catch(() => null);
  if (!request) throw new ResourceNotFoundException('Request not found');
  const workflow = await findWorkflow(request.workflowId);
  const actionable = actionableSteps(user, await loadActorContext(user, [workflow]), request, workflow);
  if (!canView(user, request, actionable)) throw new ResourceNotFoundException('Request not found');
  return { request, workflow, actionable };
}

/** Marks every applicable step of `stage` as started now. */
function startStage(request: RequestDoc, workflow: WorkflowDoc, stage: number, at: Date) {
  request.currentStep = stage;
  for (const i of stepsInStage(workflow.steps, stage)) {
    if (!request.skippedSteps.includes(i)) request.stepStartTimes.set(String(i), at);
  }
}

// ---------------------------------------------------------------------------
// Commands and queries
// ---------------------------------------------------------------------------

export async function createRequest(user: UserDoc, { title, description, workflowId, fields }: CreateRequestInput) {
  const workflow = await findWorkflow(workflowId);
  if (!workflow) throw new ResourceNotFoundException('Workflow not found');

  const { values, errors } = validateFieldValues(workflow.fields ?? [], fields);
  if (Object.keys(errors).length > 0) {
    throw new ValidationException(Object.fromEntries(Object.entries(errors).map(([k, v]) => [`fields.${k}`, v])));
  }

  // Routing is decided once, from the submitted values, and stored with the
  // request so it stays auditable.
  const skippedSteps = planSkippedSteps(workflow.steps, values);
  const firstStage = nextActiveStage(workflow.steps, skippedSteps, 0);
  if (firstStage === -1) {
    throw new BadRequestException("None of this workflow's approval steps apply to these values");
  }

  const now = new Date();
  const request = new Request({
    title,
    description,
    workflowId: workflow.id,
    workflowName: workflow.name,
    createdBy: user.id,
    createdByName: user.name,
    status: 'PENDING',
    history: [],
    fields: values,
    skippedSteps,
    updatedAt: now,
  });
  startStage(request, workflow, firstStage, now);
  await request.save();

  return request.toJSON();
}

export async function getMyRequests(user: UserDoc) {
  const requests = await Request.find({ createdBy: user.id }).sort({ createdAt: -1 });
  return requests.map((r) => r.toJSON());
}

export async function getPendingRequests(user: UserDoc) {
  const active = await Request.find({ status: { $in: ACTIVE_STATUSES } }).sort({ createdAt: 1 });

  // One workflow query (and one delegation + group query) for the whole batch.
  const workflowIds = [...new Set(active.map((r) => r.workflowId))];
  const workflows = await Workflow.find({ _id: { $in: workflowIds } }).catch(() => []);
  const byId = new Map(workflows.map((w) => [w.id as string, w]));
  const ctx = await loadActorContext(user, workflows);

  return active.flatMap((r) => {
    const actionable = actionableSteps(user, ctx, r, byId.get(r.workflowId));
    return actionable.length > 0 ? [{ ...r.toJSON(), actionableSteps: actionable }] : [];
  });
}

export async function getRequestById(user: UserDoc, id: string) {
  const { request, actionable } = await loadVisibleRequest(user, id);
  return { ...request.toJSON(), actionableSteps: actionable };
}

export function approveRequest(user: UserDoc, id: string, comment?: string | null, stepIndex?: number | null) {
  return processRequest(user, id, 'APPROVED', comment, stepIndex);
}

export function rejectRequest(user: UserDoc, id: string, comment?: string | null, stepIndex?: number | null) {
  return processRequest(user, id, 'REJECTED', comment, stepIndex);
}

/** Explains why `user` can't act, for steps they asked about (or all pending ones). */
function refusalReason(user: UserDoc, request: RequestDoc, workflow: WorkflowDoc, steps: number[]): string {
  if (request.createdBy === user.id) return 'You cannot act on your own request';
  if (steps.length === 0) return 'This step is not awaiting action';
  if (involvedInStage(request, workflow, user.id) || steps.some((i) => approversFor(request, i).includes(user.id))) {
    return 'You have already approved this step';
  }
  return 'User role does not match required role for this step';
}

async function processRequest(
  user: UserDoc,
  requestId: string,
  actionType: ActionType,
  comment?: string | null,
  requestedStep?: number | null,
) {
  const request = await Request.findById(requestId).catch(() => null);
  if (!request) throw new ResourceNotFoundException('Request not found');
  if (!isActive(request)) throw new BadRequestException('Request already finalized');

  const workflow = await findWorkflow(request.workflowId);
  if (!workflow) throw new ResourceNotFoundException('Workflow not found');

  const pending = pendingSteps(request, workflow);
  const candidates = actionableSteps(user, await loadActorContext(user, [workflow]), request, workflow);

  let capacity: ActionableStep | undefined;
  if (requestedStep !== undefined && requestedStep !== null) {
    capacity = candidates.find((c) => c.stepIndex === requestedStep);
    if (!capacity) {
      const asked = pending.includes(requestedStep) ? [requestedStep] : [];
      throw new BadRequestException(refusalReason(user, request, workflow, asked));
    }
  } else if (candidates.length === 1) {
    capacity = candidates[0];
  } else if (candidates.length > 1) {
    throw new BadRequestException('Several steps are waiting for you; specify stepIndex');
  } else {
    throw new BadRequestException(refusalReason(user, request, workflow, pending));
  }
  const stepIndex = capacity!.stepIndex;
  const onBehalfOf = capacity!.onBehalfOf ?? null;

  const lastEntry = request.history[request.history.length - 1];
  const previousHash = lastEntry?.currentHash ?? GENESIS_HASH;
  const timestamp = new Date();
  const currentHash = computeHash({
    stepIndex,
    action: actionType,
    actedBy: user.id,
    comment,
    timestamp: timestamp.toISOString(),
    previousHash,
    onBehalfOf: onBehalfOf?.id,
  });

  request.history.push({
    stepIndex,
    action: actionType,
    actedBy: user.id,
    actedByName: user.name,
    onBehalfOf: onBehalfOf?.id ?? null,
    onBehalfOfName: onBehalfOf?.name ?? null,
    comment,
    timestamp,
    previousHash,
    currentHash,
  });
  request.updatedAt = timestamp;

  if (actionType === 'REJECTED') {
    // Any rejection, in any parallel branch, rejects the request.
    request.status = 'REJECTED';
  } else {
    const principal = onBehalfOf?.id ?? user.id;
    request.stepApprovals.set(String(stepIndex), [...approversFor(request, stepIndex), principal]);
    request.status = 'IN_REVIEW';

    if (pendingSteps(request, workflow).length === 0) {
      const next = nextActiveStage(workflow.steps, request.skippedSteps, request.currentStep + 1);
      if (next === -1) {
        request.status = 'APPROVED';
      } else {
        startStage(request, workflow, next, timestamp);
        // Escalation applies to the steps that breached their SLA, not later ones.
        request.escalated = false;
        request.escalatedSteps = [];
        request.originalRequiredRole = null;
      }
    }
  }

  // optimisticConcurrency on the schema makes this fail with a VersionError
  // (→ 409) if another approver saved this request since we loaded it.
  await request.save();
  return request.toJSON();
}

// Recomputes the SHA-256 chain over the request's audit history and reports
// the first entry whose link or contents don't match.
export async function verifyRequestChain(user: UserDoc, id: string): Promise<ChainVerification> {
  const { request } = await loadVisibleRequest(user, id);
  const length = request.history.length;

  let expectedPrevious = GENESIS_HASH;
  for (const [i, entry] of request.history.entries()) {
    const fail = (reason: string): ChainVerification => ({ valid: false, length, brokenAtIndex: i, reason });

    if (!entry.currentHash || !entry.previousHash) return fail('Entry has no hash (recorded before hashing was enabled)');
    if (entry.previousHash !== expectedPrevious) return fail('previousHash does not match the prior entry');

    const recomputed = computeHash({
      stepIndex: entry.stepIndex,
      action: entry.action,
      actedBy: entry.actedBy,
      comment: entry.comment,
      timestamp: new Date(entry.timestamp).toISOString(),
      previousHash: entry.previousHash,
      onBehalfOf: entry.onBehalfOf,
      // Any entry carrying an AI block is covered, so an `ai` block can't be added to or stripped from one.
      aiDigest: entry.ai ? aiDigest(entry.ai) : null,
    });
    if (recomputed !== entry.currentHash) return fail('Entry contents do not match its hash');

    expectedPrevious = entry.currentHash;
  }

  return { valid: true, length, headHash: expectedPrevious };
}

// ---------------------------------------------------------------------------
// AI reviewer copilot
//
// The copilot only advises. Its recommendation is appended to the same
// hash-chained history as human decisions, but with its own action type that
// the routing code never looks at: it can't approve, reject, or advance a
// request. Actor is `ai:<model>`, which can't collide with a user id.
// ---------------------------------------------------------------------------

/** A request the user may see and that is still open, with its workflow. */
export async function loadRequestForAiReview(user: UserDoc, id: string) {
  const { request, workflow } = await loadVisibleRequest(user, id);
  if (!isActive(request)) throw new BadRequestException('Request already finalized; there is nothing left to review');
  if (!workflow) throw new ResourceNotFoundException('Workflow not found');
  return { request, workflow };
}

export async function appendAiRecommendation(requestId: string, ai: AiRecommendation) {
  // The model call takes seconds, so approvers may have acted meanwhile. Reload
  // and chain onto whatever the head is now; retry if someone saves in between.
  for (let attempt = 0; attempt < 3; attempt++) {
    const request = await Request.findById(requestId);
    if (!request) throw new ResourceNotFoundException('Request not found');

    const previousHash = request.history[request.history.length - 1]?.currentHash ?? GENESIS_HASH;
    const timestamp = new Date();
    const actedBy = `ai:${ai.model}`;
    const stepIndex = request.currentStep;
    const currentHash = computeHash({
      stepIndex,
      action: AI_RECOMMENDATION_ACTION,
      actedBy,
      timestamp: timestamp.toISOString(),
      previousHash,
      aiDigest: aiDigest(ai),
    });
    request.history.push({
      stepIndex,
      action: AI_RECOMMENDATION_ACTION,
      actedBy,
      actedByName: 'AI reviewer',
      ai,
      timestamp,
      previousHash,
      currentHash,
    });

    try {
      await request.save();
    } catch (err) {
      if (err instanceof mongoose.Error.VersionError) continue;
      throw err;
    }
    return request.toJSON().history[request.history.length - 1]!;
  }
  throw new ConflictException('The request changed while the AI was reviewing it. Try again.');
}

export async function getAllRequests() {
  const requests = await Request.find().sort({ createdAt: -1 });
  return requests.map((r) => r.toJSON());
}

export { pendingSteps };
