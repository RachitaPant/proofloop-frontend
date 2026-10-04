import jwt from 'jsonwebtoken';
import type { Role } from '@proofloop/shared';

const EXPIRATION_MS = Number(process.env.JWT_EXPIRATION_MS || 86_400_000);

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
  }
  return secret;
}

// subject = email, "role" claim, HS256 (same token shape as the Spring Boot backend).
export function generateToken(email: string, role: Role): string {
  return jwt.sign({ role }, getSecret(), {
    algorithm: 'HS256',
    subject: email,
    expiresIn: Math.floor(EXPIRATION_MS / 1000),
  });
}

export function verifyToken(token: string): jwt.JwtPayload {
  const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
  if (typeof payload === 'string') throw new Error('Unexpected token payload');
  return payload;
}
