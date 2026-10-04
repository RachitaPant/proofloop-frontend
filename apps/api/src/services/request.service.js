const Request = require('../models/Request');
const Workflow = require('../models/Workflow');
const { ResourceNotFoundException, BadRequestException } = require('../utils/errors');
const { GENESIS_HASH, computeHash } = require('../utils/hash');

const ACTIVE_STATUSES = ['PENDING', 'IN_REVIEW'];

// SLA escalation is recorded on the request, never on the shared workflow
// template — so it only reroutes this request's current step to ADMIN.
function effectiveRequiredRole(request, step) {
  return request.escalated ? 'ADMIN' : step.requiredRole;
}

function approversFor(request, stepIndex) {
  return request.stepApprovals.get(String(stepIndex)) || [];
}

function isActive(request) {
  return ACTIVE_STATUSES.includes(request.status);
}

// Who may act on the request's current step right now.
function canActOn(user, request, workflow) {
  if (!isActive(request) || !workflow) return false;
  const step = workflow.steps[request.currentStep];
  if (!step) return false;
  if (request.createdBy === user.id) return false; // no self-approval
  if (effectiveRequiredRole(request, step) !== user.role) return false;
  return !approversFor(request, request.currentStep).includes(user.id);
}

// Who may see the request: its creator, admins, anyone who already acted on
// it, and anyone eligible to act on its current step.
function canView(user, request, workflow) {
  if (user.role === 'ADMIN') return true;
  if (request.createdBy === user.id) return true;
  if (request.history.some((a) => a.actedBy === user.id)) return true;
  return canActOn(user, request, workflow);
}

async function findWorkflow(id) {
  return Workflow.findById(id).catch(() => null);
}

// Loads a request the user is allowed to see. Returns 404 (not 403) for
// requests they can't see, so IDs can't be probed for existence.
async function loadVisibleRequest(user, id) {
  const request = await Request.findById(id).catch(() => null);
  if (!request) throw new ResourceNotFoundException('Request not found');
  const workflow = await findWorkflow(request.workflowId);
  if (!canView(user, request, workflow)) throw new ResourceNotFoundException('Request not found');
  return { request, workflow };
}

async function createRequest(user, { title, description, workflowId }) {
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

async function getMyRequests(user) {
  const requests = await Request.find({ createdBy: user.id }).sort({ createdAt: -1 });
  return requests.map((r) => r.toJSON());
}

async function getPendingRequests(user) {
  const active = await Request.find({ status: { $in: ACTIVE_STATUSES } }).sort({ createdAt: 1 });

  // One workflow query for the whole batch instead of one per request.
  const workflowIds = [...new Set(active.map((r) => r.workflowId))];
  const workflows = await Workflow.find({ _id: { $in: workflowIds } }).catch(() => []);
  const byId = new Map(workflows.map((w) => [w.id, w]));

  return active.filter((r) => canActOn(user, r, byId.get(r.workflowId))).map((r) => r.toJSON());
}

async function getRequestById(user, id) {
  const { request } = await loadVisibleRequest(user, id);
  return request.toJSON();
}

async function approveRequest(user, id, comment) {
  return processRequest(user, id, 'APPROVED', comment);
}

async function rejectRequest(user, id, comment) {
  return processRequest(user, id, 'REJECTED', comment);
}

async function processRequest(user, requestId, actionType, comment) {
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

  const previousHash = request.history.length > 0 ? request.history[request.history.length - 1].currentHash : GENESIS_HASH;
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
      // Quorum not reached yet — stay on this step.
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
async function verifyRequestChain(user, id) {
  const { request } = await loadVisibleRequest(user, id);

  let expectedPrevious = GENESIS_HASH;
  for (let i = 0; i < request.history.length; i++) {
    const entry = request.history[i];
    const fail = (reason) => ({ valid: false, length: request.history.length, brokenAtIndex: i, reason });

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

  return {
    valid: true,
    length: request.history.length,
    headHash: request.history.length > 0 ? expectedPrevious : GENESIS_HASH,
  };
}

async function getAllRequests() {
  const requests = await Request.find().sort({ createdAt: -1 });
  return requests.map((r) => r.toJSON());
}

module.exports = {
  createRequest,
  getMyRequests,
  getPendingRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
  verifyRequestChain,
  getAllRequests,
  effectiveRequiredRole,
};
