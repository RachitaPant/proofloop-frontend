import { ACTIVE_STATUSES, normalizeStages, type CreateWorkflowInput } from '@proofloop/shared';
import { Workflow } from '../models/Workflow';
import { ApproverGroup } from '../models/ApproverGroup';
import { Request } from '../models/Request';
import type { UserDoc } from '../models/User';
import { AccessDeniedException, ConflictException, ResourceNotFoundException, ValidationException } from '../utils/errors';

export async function createWorkflow(user: UserDoc, { name, description, fields, steps }: CreateWorkflowInput) {
  // Group-assigned steps must point at real groups; keep the name for display.
  const groupIds = [...new Set(steps.flatMap((s) => (s.approverGroupId ? [s.approverGroupId] : [])))];
  const groups = groupIds.length ? await ApproverGroup.find({ _id: { $in: groupIds } }) : [];
  const groupName = new Map(groups.map((g) => [g.id as string, g.name]));
  const unknown = steps.flatMap((s, i) =>
    s.approverGroupId && !groupName.has(s.approverGroupId) ? [[`steps[${i}].approverGroupId`, 'Unknown approver group']] : [],
  );
  if (unknown.length) throw new ValidationException(Object.fromEntries(unknown));

  const workflow = await Workflow.create({
    name,
    description,
    createdBy: user.id,
    fields: fields.map((f) => ({ ...f, options: f.type === 'select' ? f.options : undefined })),
    // Stages are renumbered 0..n-1 and steps ordered by stage; stepIndex is the
    // final position, so client-supplied indexes can't drift.
    steps: normalizeStages(steps).map((s, i) => ({
      stepIndex: i,
      stepName: s.stepName,
      requiredRole: s.approverGroupId ? null : s.requiredRole,
      approverGroupId: s.approverGroupId ?? null,
      approverGroupName: s.approverGroupId ? groupName.get(s.approverGroupId) : null,
      requiredApprovals: s.requiredApprovals ?? 1,
      slaHours: s.slaHours ?? null,
      stage: s.stage,
      condition: s.condition ?? null,
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
