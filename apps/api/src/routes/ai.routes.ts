import { Router } from 'express';
import { AiWorkflowDraftInput } from '@proofloop/shared';
import { validateBody } from '../middleware/validate';
import { currentUser, requireAuth } from '../middleware/auth';
import * as aiService from '../services/ai.service';

export const aiRoutes = Router();
aiRoutes.use(requireAuth);

// Lets the web app hide AI features when no API key is configured.
aiRoutes.get('/status', (_req, res) => {
  res.json({ enabled: aiService.isAiEnabled() });
});

// Returns a draft for the user to review in the workflow builder. Nothing is
// saved: creating the workflow still goes through POST /api/workflows.
aiRoutes.post('/workflow-draft', validateBody(AiWorkflowDraftInput), async (req, res) => {
  res.json(await aiService.draftWorkflow(currentUser(req), req.body.prompt));
});
