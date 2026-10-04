import { ACTIVE_STATUSES, type CreateWorkflowInput } from '@proofloop/shared';
import { Workflow } from '../models/Workflow';
import { Request } from '../models/Request';
import type { UserDoc } from '../models/User';
import { AccessDeniedException, ConflictException, ResourceNotFoundException } from '../utils/errors';

export async function createWorkflow(user: UserDoc, { name, description, steps }: CreateWorkflowInput) {
  const workflow = await Workflow.create({
    name,
    description,
    createdBy: user.id,
    // Step order is the array order; stepIndex is normalised so it can't drift.
    steps: steps.map((s, i) => ({
      stepIndex: i,
      stepName: s.stepName,
      requiredRole: s.requiredRole,
      requiredApprovals: s.requiredApprovals ?? 1,
      slaHours: s.slaHours ?? null,
    })),
  });
  return workflow.toJSON();
}

export async function getAllWorkflows() {
  const workflows = await Workflow.find().sort({ createdAt: -1 });
  return workflows.map((w) => w.toJSON());
}

export async function getWorkflowById(id: string) {
  const workflow = await Workflow.findById(id).catch(() => null);
  if (!workflow) throw new ResourceNotFoundException(`Workflow not found with id: ${id}`);
  return workflow.toJSON();
}

// Only the workflow's creator or an ADMIN may delete it, and never while
// requests are still moving through it (they'd be orphaned mid-approval).
export async function deleteWorkflow(user: UserDoc, id: string) {
  const workflow = await Workflow.findById(id).catch(() => null);
  if (!workflow) throw new ResourceNotFoundException(`Workflow not found with id: ${id}`);

  if (user.role !== 'ADMIN' && workflow.createdBy !== user.id) {
    throw new AccessDeniedException('Only the workflow creator or an admin can delete this workflow');
  }

  const activeCount = await Request.countDocuments({ workflowId: workflow.id, status: { $in: ACTIVE_STATUSES } });
  if (activeCount > 0) {
    throw new ConflictException(`Workflow has ${activeCount} active request(s); resolve them before deleting`);
  }

  await Workflow.deleteOne({ _id: id });
}
