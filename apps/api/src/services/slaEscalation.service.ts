import mongoose from 'mongoose';
import { ACTIVE_STATUSES } from '@proofloop/shared';
import { Request, type RequestDoc } from '../models/Request';
import { Workflow, type WorkflowDoc } from '../models/Workflow';

const HOUR_MS = 60 * 60 * 1000;

// Escalates a request's current step to ADMIN once that step's SLA deadline
// has passed. The escalation is stored on the request only (escalated +
// originalRequiredRole); the shared workflow template is never modified, so
// other requests on the same workflow are unaffected.
export async function checkAndEscalateRequests(): Promise<number> {
  const activeRequests = await Request.find({ status: { $in: ACTIVE_STATUSES }, escalated: { $ne: true } });

  const workflowIds = [...new Set(activeRequests.map((r) => r.workflowId))];
  const workflows = await Workflow.find({ _id: { $in: workflowIds } }).catch(() => []);
  const byId = new Map(workflows.map((w) => [w.id as string, w]));

  let escalatedCount = 0;
  for (const request of activeRequests) {
    try {
      if (await checkAndEscalateIfNeeded(request, byId.get(request.workflowId))) escalatedCount++;
    } catch (err) {
      // A VersionError means an approver acted on it mid-check; the next run will re-evaluate.
      if (!(err instanceof mongoose.Error.VersionError)) {
        console.error(`Error processing request ${request.id} for SLA escalation:`, (err as Error).message);
      }
    }
  }

  console.log(`SLA escalation check completed. Escalated ${escalatedCount} requests.`);
  return escalatedCount;
}

async function checkAndEscalateIfNeeded(request: RequestDoc, workflow: WorkflowDoc | undefined) {
  const currentStep = workflow?.steps[request.currentStep];
  if (!currentStep) return false;
  if (!currentStep.slaHours || currentStep.slaHours <= 0) return false;
  if (currentStep.requiredRole === 'ADMIN') return false; // nowhere higher to escalate to

  const stepStartTime = request.stepStartTimes.get(String(request.currentStep)) ?? request.createdAt;
  const hoursElapsed = (Date.now() - new Date(stepStartTime).getTime()) / HOUR_MS;

  if (hoursElapsed > currentStep.slaHours) {
    request.escalated = true;
    request.originalRequiredRole = currentStep.requiredRole;
    await request.save();
    console.log(`Request ${request.id} escalated to ADMIN due to SLA breach`);
    return true;
  }

  return false;
}

export function startScheduler() {
  setInterval(() => {
    checkAndEscalateRequests().catch((err) => console.error('SLA escalation run failed:', err));
  }, HOUR_MS);
}
