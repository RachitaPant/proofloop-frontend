import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { RefreshToken } from '../models/RefreshToken';
import { User, type UserDoc } from '../models/User';
import { generateToken } from '../utils/jwt';
import { UnauthorizedException } from '../utils/errors';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  clearAuthCookies,
  readRefreshCookie,
  setAuthCookies,
} from '../config/authCookies';

// A just-rotated token presented again within this window is treated as a
// benign race (two tabs refreshing at once) rather than theft.
const REUSE_GRACE_MS = 10_000;

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

async function issueRefreshToken(user: UserDoc, familyId: string, req: Request): Promise<string> {
  const raw = crypto.randomBytes(32).toString('base64url');
  await RefreshToken.create({
    userId: user.id,
    familyId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    userAgent: req.headers['user-agent']?.slice(0, 200),
  });
  return raw;
}

/** Starts a new browser session (new token family) and sets both cookies. */
export async function startSession(req: Request, res: Response, user: UserDoc) {
  const refreshToken = await issueRefreshToken(user, crypto.randomUUID(), req);
  setAuthCookies(res, generateToken(user.email, user.role, ACCESS_TOKEN_TTL_SECONDS), refreshToken);
}

/**
 * Exchanges the refresh cookie for a new access + refresh pair. The presented
 * token is revoked (single use). Presenting an already-revoked token outside
 * the grace window means it was copied: the whole family is revoked.
 */
export async function refreshSession(req: Request, res: Response): Promise<UserDoc> {
  const raw = readRefreshCookie(req);
  if (!raw) throw new UnauthorizedException('No refresh token');

  const now = new Date();
  // Atomically claim the token so two concurrent refreshes can't both rotate it.
  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash: hashToken(raw), revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now } },
  );

  if (!claimed) {
    const existing = await RefreshToken.findOne({ tokenHash: hashToken(raw) });
    if (existing?.revokedAt && now.getTime() - existing.revokedAt.getTime() > REUSE_GRACE_MS) {
      await RefreshToken.updateMany({ familyId: existing.familyId, revokedAt: null }, { $set: { revokedAt: now } });
    }
    clearAuthCookies(res);
    throw new UnauthorizedException('Session expired');
  }

  const user = await User.findById(claimed.userId);
  if (!user) {
    clearAuthCookies(res);
    throw new UnauthorizedException('User not found');
  }

  const next = await issueRefreshToken(user, claimed.familyId, req);
  setAuthCookies(res, generateToken(user.email, user.role, ACCESS_TOKEN_TTL_SECONDS), next);
  return user;
}

/** Revokes this browser's token family (if any) and clears the cookies. */
export async function endSession(req: Request, res: Response) {
  const raw = readRefreshCookie(req);
  if (raw) {
    const token = await RefreshToken.findOne({ tokenHash: hashToken(raw) });
    if (token) {
      await RefreshToken.updateMany({ familyId: token.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    }
  }
  clearAuthCookies(res);
}
