import { Router, type Request } from 'express';
import { UpdateRoleInput } from '@proofloop/shared';
import { validateBody } from '../middleware/validate';
import { currentUser, requireAdmin, requireAuth } from '../middleware/auth';
import * as analyticsService from '../services/analytics.service';
import * as requestService from '../services/request.service';
import * as slaEscalationService from '../services/slaEscalation.service';
import * as userService from '../services/user.service';

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireAdmin);

adminRoutes.get('/analytics', async (_req, res) => {
  res.json(await analyticsService.getAnalytics());
});

adminRoutes.get('/requests', async (_req, res) => {
  res.json(await requestService.getAllRequests());
});

adminRoutes.get('/users', async (_req, res) => {
  res.json(await userService.listUsers());
});

adminRoutes.patch('/users/:id/role', validateBody(UpdateRoleInput), async (req: Request<{ id: string }>, res) => {
  res.json(await userService.updateRole(currentUser(req), req.params.id, req.body.role));
});

adminRoutes.post('/trigger-sla-check', async (_req, res) => {
  const escalatedCount = await slaEscalationService.checkAndEscalateRequests();
  res.json({ message: 'SLA escalation check triggered', escalatedCount });
});
