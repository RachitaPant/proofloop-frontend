import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { CreateInviteInput, UpdateRoleInput } from '@proofloop/shared';
import { validateBody } from '../middleware/validate';
import { currentUser, requireAdmin, requireAuth } from '../middleware/auth';
import * as analyticsService from '../services/analytics.service';
import * as requestService from '../services/request.service';
import * as slaEscalationService from '../services/slaEscalation.service';
import * as orgService from '../services/org.service';
import * as userService from '../services/user.service';
import { appBaseUrl } from '../utils/appUrl';

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireAdmin);

// Each invite sends an email to an address the admin typed, so cap how fast an
// account can fire them off (per instance, like the sign-in limiter).
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.INVITE_RATE_LIMIT || 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${(req as Request).user?.id ?? 'anon'}`,
  validate: { keyGeneratorIpFallback: false },
  message: { status: 429, error: 'Too Many Requests', message: 'Too many invites sent, please try again later.' },
});

adminRoutes.get('/analytics', async (req, res) => {
  res.json(await analyticsService.getAnalytics(currentUser(req).orgId));
});

adminRoutes.get('/requests', async (req, res) => {
  res.json(await requestService.getAllRequests(currentUser(req)));
});

adminRoutes.get('/users', async (req, res) => {
  res.json(await userService.listUsers(currentUser(req)));
});

adminRoutes.patch('/users/:id/role', validateBody(UpdateRoleInput), async (req: Request<{ id: string }>, res) => {
  res.json(await userService.updateRole(currentUser(req), req.params.id, req.body.role));
});

adminRoutes.delete('/users/:id', async (req: Request<{ id: string }>, res) => {
  await orgService.removeMember(currentUser(req), req.params.id);
  res.status(204).send();
});

adminRoutes.get('/invites', async (req, res) => {
  res.json(await orgService.listInvites(currentUser(req)));
});

adminRoutes.post('/invites', inviteLimiter, validateBody(CreateInviteInput), async (req, res) => {
  res.status(201).json(await orgService.createInvite(currentUser(req), req.body, appBaseUrl(req)));
});

adminRoutes.post('/invites/:id/resend', inviteLimiter, async (req: Request<{ id: string }>, res) => {
  res.json(await orgService.resendInvite(currentUser(req), req.params.id, appBaseUrl(req)));
});

adminRoutes.delete('/invites/:id', async (req: Request<{ id: string }>, res) => {
  await orgService.revokeInvite(currentUser(req), req.params.id);
  res.status(204).send();
});

adminRoutes.post('/trigger-sla-check', async (req, res) => {
  // Only this organisation's requests: one tenant must not act on another's.
  const escalatedCount = await slaEscalationService.checkAndEscalateRequests(currentUser(req).orgId);
  res.json({ message: 'SLA escalation check triggered', escalatedCount });
});
