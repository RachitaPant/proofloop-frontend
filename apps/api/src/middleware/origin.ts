import type { NextFunction, Request, Response } from 'express';
import { AccessDeniedException } from '../utils/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CORS_ALLOWED_ORIGINS is a comma-separated list. An entry may contain `*`
 * wildcards, e.g. https://proofloop-frontend-*-rachitapants-projects.vercel.app
 * to allow Vercel preview deployments. A `*` never matches a dot or slash,
 * so it can't stretch across domain labels.
 */
export function allowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function matches(pattern: string, origin: string): boolean {
  if (!pattern.includes('*')) return pattern === origin;
  const regex = new RegExp(`^${pattern.split('*').map(escapeRegex).join('[^./]*')}$`);
  return regex.test(origin);
}

export function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins().some((pattern) => matches(pattern, origin));
}

/**
 * CSRF defence for cookie-authenticated writes, on top of SameSite=Lax: a
 * state-changing request must come from one of our own origins. Browsers
 * always send Origin (or at least Sec-Fetch-Site) on cross-site POSTs; a
 * request with neither is not from a browser, so it can't be carrying a
 * victim's cookies.
 */
export function isTrustedOrigin(req: Request): boolean {
  if (SAFE_METHODS.has(req.method)) return true;

  const origin = req.headers.origin;
  if (origin) return isAllowedOrigin(origin);

  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';

  return true;
}

export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction) {
  if (!isTrustedOrigin(req)) throw new AccessDeniedException('Cross-site request blocked');
  next();
}
