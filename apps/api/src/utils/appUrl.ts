import type { Request } from 'express';
import { allowedOrigins, isAllowedOrigin } from '../middleware/origin';

/**
 * Where the web app lives, for links in emails. APP_URL wins. Otherwise the
 * browser's Origin header is used when it is one of our allowed origins (it
 * can't be spoofed by a page on another site), then the first concrete entry
 * of CORS_ALLOWED_ORIGINS.
 */
export function appBaseUrl(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) return origin.replace(/\/+$/, '');

  return (allowedOrigins().find((o) => !o.includes('*')) ?? 'http://localhost:3000').replace(/\/+$/, '');
}
