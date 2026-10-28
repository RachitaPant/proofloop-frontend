import { Router, type Request } from 'express';
import { CreateRequestInput, RequestActionInput } from '@proofloop/shared';
import { validateBody } from '../middleware/validate';
import { currentUser, requireAuth } from '../middleware/auth';
import * as requestService from '../services/request.service';
import * as aiReviewService from '../services/aiReview.service';

export const requestRoutes = Router();
requestRoutes.use(requireAuth);

requestRoutes.post('/', validateBody(CreateRequestInput), async (req, res) => {
  res.json(await requestService.createRequest(currentUser(req), req.body));
});

requestRoutes.get('/mine', async (req, res) => {
  res.json(await requestService.getMyRequests(currentUser(req)));
});

requestRoutes.get('/pending', async (req, res) => {
  res.json(await requestService.getPendingRequests(currentUser(req)));
});

requestRoutes.get('/:id', async (req, res) => {
  res.json(await requestService.getRequestById(currentUser(req), req.params.id));
});

requestRoutes.get('/:id/verify', async (req, res) => {
  res.json(await requestService.verifyRequestChain(currentUser(req), req.params.id));
});

// Advice only: appends the AI's recommendation to the audit trail. It never
// approves, rejects or reroutes anything.
requestRoutes.post('/:id/ai-review', async (req: Request<{ id: string }>, res) => {
  res.json(await aiReviewService.reviewRequest(currentUser(req), req.params.id));
});

requestRoutes.post('/:id/approve', validateBody(RequestActionInput), async (req: Request<{ id: string }>, res) => {
  res.json(await requestService.approveRequest(currentUser(req), req.params.id, req.body.comment, req.body.stepIndex));
});

requestRoutes.post('/:id/reject', validateBody(RequestActionInput), async (req: Request<{ id: string }>, res) => {
  res.json(await requestService.rejectRequest(currentUser(req), req.params.id, req.body.comment, req.body.stepIndex));
});
