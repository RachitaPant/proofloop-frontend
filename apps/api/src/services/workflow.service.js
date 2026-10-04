const Workflow = require('../models/Workflow');
const Request = require('../models/Request');
const { ResourceNotFoundException, AccessDeniedException, ConflictException } = require('../utils/errors');

async function createWorkflow(user, { name, description, steps }) {
  const workflow = await Workflow.create({
    name,
    description,
    createdBy: user.id,
    steps: steps.map((s) => ({
      stepIndex: s.stepIndex,
      stepName: s.stepName,
      requiredRole: s.requiredRole,
      requiredApprovals: s.requiredApprovals ?? 1,
      slaHours: s.slaHours ?? null,
    })),
  });
  return workflow.toJSON();
}

async function getAllWorkflows() {
  const workflows = await Workflow.find();
  return workflows.map((w) => w.toJSON());
}

async function getWorkflowById(id) {
  const workflow = await Workflow.findById(id).catch(() => null);
  if (!workflow) throw new ResourceNotFoundException(`Workflow not found with id: ${id}`);
  return workflow.toJSON();
}

// Only the workflow's creator or an ADMIN may delete it, and never while
// requests are still moving through it (they'd be orphaned mid-approval).
async function deleteWorkflow(user, id) {
  const workflow = await Workflow.findById(id).catch(() => null);
  if (!workflow) throw new ResourceNotFoundException(`Workflow not found with id: ${id}`);

  if (user.role !== 'ADMIN' && workflow.createdBy !== user.id) {
    throw new AccessDeniedException('Only the workflow creator or an admin can delete this workflow');
  }

  const activeCount = await Request.countDocuments({ workflowId: workflow.id, status: { $in: ['PENDING', 'IN_REVIEW'] } });
  if (activeCount > 0) {
    throw new ConflictException(`Workflow has ${activeCount} active request(s); resolve them before deleting`);
  }

  await Workflow.deleteOne({ _id: id });
}

module.exports = { createWorkflow, getAllWorkflows, getWorkflowById, deleteWorkflow };
