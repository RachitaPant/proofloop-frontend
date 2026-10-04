import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@proofloop/shared';
import { User, type UserDoc } from '../models/User';
import { verifyToken } from '../utils/jwt';
import { AccessDeniedException, UnauthorizedException } from '../utils/errors';

// Validates the bearer token, loads the user fresh from the DB (so role
// changes take effect immediately), and attaches it to req.user.
// 401 = not authenticated (missing/invalid/expired token): the client should
// re-login. 403 = authenticated but not allowed.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedException('Missing or invalid Authorization header');
  }

  let email: string | undefined;
  try {
    email = verifyToken(header.slice(7)).sub;
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

/** The authenticated user. Only valid on routes behind requireAuth. */
export function currentUser(req: Request): UserDoc {
  if (!req.user) throw new UnauthorizedException();
  return req.user;
}
