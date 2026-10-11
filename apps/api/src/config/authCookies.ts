import type { CookieOptions, Request, Response } from 'express';

// Browser sessions use two httpOnly cookies, never readable from page scripts:
//  - access:  short-lived JWT, sent with every API call (Path=/)
//  - refresh: opaque rotating token, only sent to /api/auth (Path=/api/auth)
//
// The web app reaches the API through a same-origin proxy (Next.js rewrites),
// so these are first-party cookies on the web app's domain. Over HTTPS they
// use the __Host-/__Secure- prefixes, which browsers only accept with the
// Secure flag (and, for __Host-, no Domain and Path=/).

export const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 15 * 60);
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
const REFRESH_PATH = '/api/auth';

function isSecure() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

export function accessCookieName() {
  return isSecure() ? '__Host-pl_at' : 'pl_at';
}

export function refreshCookieName() {
  return isSecure() ? '__Secure-pl_rt' : 'pl_rt';
}

function baseOptions(): CookieOptions {
  return { httpOnly: true, secure: isSecure(), sameSite: 'lax' };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(accessCookieName(), accessToken, { ...baseOptions(), path: '/', maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000 });
  res.cookie(refreshCookieName(), refreshToken, {
    ...baseOptions(),
    path: REFRESH_PATH,
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(accessCookieName(), { ...baseOptions(), path: '/' });
  res.clearCookie(refreshCookieName(), { ...baseOptions(), path: REFRESH_PATH });
}

export function readAccessCookie(req: Request): string | undefined {
  return req.cookies?.[accessCookieName()];
}

export function readRefreshCookie(req: Request): string | undefined {
  return req.cookies?.[refreshCookieName()];
}
