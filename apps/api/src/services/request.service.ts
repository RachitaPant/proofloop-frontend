import {
  ACTIVE_STATUSES,
  type ActionType,
  type ChainVerification,
  type CreateRequestInput,
  type Role,
} from '@proofloop/shared';
import { Request, type RequestDoc } from '../models/Request';
import { Workflow, type IWorkflowStep, type WorkflowDoc } from '../models/Workflow';
import type { UserDoc } from '../models/User';
import { BadRequestException, ResourceNotFoundException } from '../utils/errors';
import { GENESIS_HASH, computeHash } from '../utils/hash';

// SLA escalation is recorded on the request, never on the shared workflow
// template, so it only reroutes this request's current step to ADMIN.
export function effectiveRequiredRole(request: RequestDoc, step: IWorkflowStep): Role {
  return request.escalated ? 'ADMIN' : step.requiredRole;
}

function approversFor(request: RequestDoc, stepIndex: number): string[] {
  return request.stepApprovals.get(String(stepIndex)) ?? [];
}

function isActive(request: RequestDoc) {
  return ACTIVE_STATUSES.includes(request.status);
}

// Who may act on the request's current step right now.
function canActOn(user: UserDoc, request: RequestDoc, workflow: WorkflowDoc | null | undefined) {
  if (!isActive(request) || !workflow) return false;
  const step = workflow.steps[request.currentStep];
  if (!step) return false;
  if (request.createdBy === user.id) return false; // no self-approval
  if (effectiveRequiredRole(request, step) !== user.role) return false;
  return !approversFor(request, request.currentStep).includes(user.id);
}

// Who may see the request: its creator, admins, anyone who already acted on
// it, and anyone eligible to act on its current step.
function canView(user: UserDoc, request: RequestDoc, workflow: WorkflowDoc | null) {
  if (user.role === 'ADMIN') return true;
  if (request.createdBy === user.id) return true;
  if (request.history.some((a) => a.actedBy === user.id)) return true;
  return canActOn(user, request, workflow);
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
  if (!canView(user, request, workflow)) throw new ResourceNotFoundException('Request not found');
  return { request, workflow };
}

export async function createRequest(user: UserDoc, { title, description, workflowId }: CreateRequestInput) {
  const workflow = await findWorkflow(workflowId);
  if (!workflow) throw new ResourceNotFoundException('Workflow not found');

  const now = new Date();
  const request = await Request.create({
    title,
    description,
    workflowId: workflow.id,
    workflowName: workflow.name,
    createdBy: user.id,
    createdByName: user.name,
    currentStep: 0,
    status: 'PENDING',
    history: [],
    stepStartTimes: { 0: now },
    updatedAt: now,
  });

  return request.toJSON();
}

export async function getMyRequests(user: UserDoc) {
  const requests = await Request.find({ createdBy: user.id }).sort({ createdAt: -1 });
  return requests.map((r) => r.toJSON());
}

export async function getPendingRequests(user: UserDoc) {
  const active = await Request.find({ status: { $in: ACTIVE_STATUSES } }).sort({ createdAt: 1 });

  // One workflow query for the whole batch instead of one per request.
  const workflowIds = [...new Set(active.map((r) => r.workflowId))];
  const workflows = await Workflow.find({ _id: { $in: workflowIds } }).catch(() => []);
  const byId = new Map(workflows.map((w) => [w.id as string, w]));

  return active.filter((r) => canActOn(user, r, byId.get(r.workflowId))).map((r) => r.toJSON());
}

export async function getRequestById(user: UserDoc, id: string) {
  const { request } = await loadVisibleRequest(user, id);
  return request.toJSON();
}

export function approveRequest(user: UserDoc, id: string, comment?: string | null) {
  return processRequest(user, id, 'APPROVED', comment);
}

export function rejectRequest(user: UserDoc, id: string, comment?: string | null) {
  return processRequest(user, id, 'REJECTED', comment);
}

async function processRequest(user: UserDoc, requestId: string, actionType: ActionType, comment?: string | null) {
  const request = await Request.findById(requestId).catch(() => null);
  if (!request) throw new ResourceNotFoundException('Request not found');

  if (!isActive(request)) {
    throw new BadRequestException('Request already finalized');
  }

  const workflow = await findWorkflow(request.workflowId);
  if (!workflow) throw new ResourceNotFoundException('Workflow not found');

  const stepIndex = request.currentStep;
  const step = workflow.steps[stepIndex];
  if (!step) throw new BadRequestException('Invalid workflow step');

  if (request.createdBy === user.id) {
    throw new BadRequestException('You cannot act on your own request');
  }
  if (effectiveRequiredRole(request, step) !== user.role) {
    throw new BadRequestException('User role does not match required role for this step');
  }
  const approvers = approversFor(request, stepIndex);
  if (approvers.includes(user.id)) {
    throw new BadRequestException('You have already approved this step');
  }

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
  });

  request.history.push({
    stepIndex,
    action: actionType,
    actedBy: user.id,
    actedByName: user.name,
    comment,
    timestamp,
    previousHash,
    currentHash,
  });
  request.updatedAt = timestamp;

  if (actionType === 'REJECTED') {
    request.status = 'REJECTED';
  } else {
    const updatedApprovers = [...approvers, user.id];
    request.stepApprovals.set(String(stepIndex), updatedApprovers);

    const required = step.requiredApprovals || 1;
    if (updatedApprovers.length < required) {
      // Quorum not reached yet: stay on this step.
      request.status = 'IN_REVIEW';
    } else if (stepIndex + 1 >= workflow.steps.length) {
      request.status = 'APPROVED';
    } else {
      request.currentStep = stepIndex + 1;
      request.status = 'IN_REVIEW';
      request.stepStartTimes.set(String(stepIndex + 1), timestamp);
      // Escalation applies to the step that breached its SLA, not later ones.
      request.escalated = false;
      request.originalRequiredRole = null;
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
    });
    if (recomputed !== entry.currentHash) return fail('Entry contents do not match its hash');

    expectedPrevious = entry.currentHash;
  }

  return { valid: true, length, headHash: expectedPrevious };
}

export async function getAllRequests() {
  const requests = await Request.find().sort({ createdAt: -1 });
  return requests.map((r) => r.toJSON());
}
