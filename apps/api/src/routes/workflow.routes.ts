import { Router } from 'express';
import { CreateWorkflowInput } from '@proofloop/shared';
import { validateBody } from '../middleware/validate';
import { currentUser, requireAuth } from '../middleware/auth';
import * as workflowService from '../services/workflow.service';

export const workflowRoutes = Router();
workflowRoutes.use(requireAuth);

workflowRoutes.post('/', validateBody(CreateWorkflowInput), async (req, res) => {
  res.json(await workflowService.createWorkflow(currentUser(req), req.body));
});

workflowRoutes.get('/', async (_req, res) => {
  res.json(await workflowService.getAllWorkflows());
});

workflowRoutes.get('/:id', async (req, res) => {
  res.json(await workflowService.getWorkflowById(req.params.id));
});

workflowRoutes.delete('/:id', async (req, res) => {
  await workflowService.deleteWorkflow(currentUser(req), req.params.id);
  res.status(204).send();
});
