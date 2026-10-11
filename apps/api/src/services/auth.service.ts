import bcrypt from 'bcryptjs';
import type { AuthResponse, LoginInput, RegisterInput } from '@proofloop/shared';
import { User, type UserDoc } from '../models/User';
import { generateToken } from '../utils/jwt';
import { BadRequestException } from '../utils/errors';

// The bearer token in the body serves API clients. The web app ignores it and
// relies on the httpOnly cookies set by the route (see session.service).
export function toAuthResponse(user: UserDoc): AuthResponse {
  return {
    token: generateToken(user.email, user.role),
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

// Self-registration always creates a USER. Elevated roles are granted only by
// an ADMIN via PATCH /api/admin/users/:id/role; the client never picks its role.
export async function register({ name, email, password }: RegisterInput): Promise<UserDoc> {
  if (await User.exists({ email })) {
    throw new BadRequestException('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  return User.create({ name, email, passwordHash, role: 'USER' });
}

export async function login({ email, password }: LoginInput): Promise<UserDoc> {
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new BadRequestException('Invalid credentials');
  }
  return user;
}
