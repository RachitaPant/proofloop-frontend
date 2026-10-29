import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@proofloop/shared';
import { User, type UserDoc } from '../models/User';
import { verifyToken } from '../utils/jwt';
import { AccessDeniedException, UnauthorizedException } from '../utils/errors';
import { readAccessCookie } from '../config/authCookies';
import { isTrustedOrigin } from './origin';

// Two ways to authenticate:
//  - Authorization: Bearer <jwt>  (API clients: Postman, scripts, agents)
//  - the httpOnly access cookie   (the web app)
// Cookie-authenticated writes must also come from a trusted origin (CSRF).
// Bearer requests can't be forged cross-site, so they skip that check.
//
// Loads the user fresh from the DB (so role changes apply immediately) and
// attaches it to req.user. 401 = not authenticated (the web app refreshes or
// re-logs in); 403 = authenticated but not allowed.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = bearer ?? readAccessCookie(req);
  if (!token) {
    throw new UnauthorizedException('Missing or invalid Authorization header');
  }
  if (!bearer && !isTrustedOrigin(req)) {
    throw new AccessDeniedException('Cross-site request blocked');
  }

  let email: string | undefined;
  try {
    email = verifyToken(token).sub;
  } catch {
    throw new UnauthorizedException('Invalid or expired token');
  }

  const user = email ? await User.findOne({ email }) : null;
  if (!user) throw new UnauthorizedException('User not found');

  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw new AccessDeniedException();
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');

/** The organisation's super admin (its creator). */
export function requireOwner(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.isOwner) throw new AccessDeniedException('Only the organisation owner can do this');
  next();
}

/** The authenticated user. Only valid on routes behind requireAuth. */
export function currentUser(req: Request): UserDoc {
  if (!req.user) throw new UnauthorizedException();
  return req.user;
}
