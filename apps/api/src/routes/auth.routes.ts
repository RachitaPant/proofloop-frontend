import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { LoginInput, RegisterInput } from '@proofloop/shared';
import { validateBody } from '../middleware/validate';
import { currentUser, requireAuth } from '../middleware/auth';
import { requireTrustedOrigin } from '../middleware/origin';
import * as authService from '../services/auth.service';
import { endSession, refreshSession, startSession } from '../services/session.service';

export const authRoutes = Router();

// Brute-force protection for the credential endpoints only (refresh and /me
// run on every page load). The default in-memory store is per-instance: on
// Vercel each warm function instance has its own counter, so this is a speed
// bump rather than a hard global limit. Swap in a shared store (e.g. Upstash
// Redis) if you need a strict cross-instance limit.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 429, error: 'Too Many Requests', message: 'Too many attempts, please try again later.' },
});

// Lets the join page show which organisation an invite is for before sign-up.
authRoutes.get('/invite/:token', credentialLimiter, async (req: Request<{ token: string }>, res) => {
  res.json(await authService.previewInvite(req.params.token));
});

authRoutes.post('/register', credentialLimiter, validateBody(RegisterInput), async (req, res) => {
  const user = await authService.register(req.body);
  await startSession(req, res, user);
  res.json(authService.toAuthResponse(user));
});

authRoutes.post('/login', credentialLimiter, validateBody(LoginInput), async (req, res) => {
  const user = await authService.login(req.body);
  await startSession(req, res, user);
  res.json(authService.toAuthResponse(user));
});

// Rotates the refresh cookie and issues a fresh access cookie.
authRoutes.post('/refresh', requireTrustedOrigin, async (req, res) => {
  const user = await refreshSession(req, res);
  res.json(user.toJSON());
});

authRoutes.post('/logout', requireTrustedOrigin, async (req, res) => {
  await endSession(req, res);
  res.status(204).send();
});

authRoutes.get('/me', requireAuth, (req, res) => {
  res.json(currentUser(req).toJSON());
});
