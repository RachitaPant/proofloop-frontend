import bcrypt from 'bcryptjs';
import type { AuthResponse, LoginInput, RegisterInput } from '@proofloop/shared';
import { User, type UserDoc } from '../models/User';
import { generateToken } from '../utils/jwt';
import { BadRequestException } from '../utils/errors';

function toAuthResponse(user: UserDoc): AuthResponse {
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
export async function register({ name, email, password }: RegisterInput): Promise<AuthResponse> {
  if (await User.exists({ email })) {
    throw new BadRequestException('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role: 'USER' });
  return toAuthResponse(user);
}

export async function login({ email, password }: LoginInput): Promise<AuthResponse> {
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new BadRequestException('Invalid credentials');
  }
  return toAuthResponse(user);
}
