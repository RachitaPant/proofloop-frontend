import mongoose from 'mongoose';
import { ACTIVE_STATUSES } from '@proofloop/shared';
import { Request, type RequestDoc } from '../models/Request';
import { Workflow, type WorkflowDoc } from '../models/Workflow';
import { assigneeOf, pendingSteps } from './request.service';

const HOUR_MS = 60 * 60 * 1000;

// Escalates each pending step of a request's current stage to ADMIN once that
// step's SLA has passed. Escalation is stored on the request only
// (escalatedSteps + escalated + originalRequiredRole); the shared workflow
// template is never modified, so other requests on the same workflow are
// unaffected. Parallel steps escalate independently.
export async function checkAndEscalateRequests(orgId?: string): Promise<number> {
  const activeRequests = await Request.find({ ...(orgId ? { orgId } : {}), status: { $in: ACTIVE_STATUSES } });

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
  if (!workflow) return false;

  const now = Date.now();
  const breached = pendingSteps(request, workflow).filter((i) => {
    const step = workflow.steps[i]!;
    if (!step.slaHours || step.slaHours <= 0) return false;
    // Already escalated, or nowhere higher to escalate to.
    const assignee = assigneeOf(request, workflow, i);
    if (assignee.kind === 'role' && assignee.role === 'ADMIN') return false;
    const startedAt = request.stepStartTimes.get(String(i)) ?? request.createdAt;
    return (now - new Date(startedAt).getTime()) / HOUR_MS > step.slaHours;
  });
  if (breached.length === 0) return false;

  request.escalatedSteps = [...request.escalatedSteps, ...breached];
  request.escalated = true;
  // Group steps have no role to record; their group stays visible on the workflow.
  request.originalRequiredRole = workflow.steps[breached[0]!]!.requiredRole ?? null;
  await request.save();
  console.log(`Request ${request.id}: steps ${breached.join(', ')} escalated to ADMIN after missing their SLA`);
  return true;
}

export function startScheduler() {
  setInterval(() => {
    checkAndEscalateRequests().catch((err) => console.error('SLA escalation run failed:', err));
  }, HOUR_MS);
}
