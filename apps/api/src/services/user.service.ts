import type { Role } from '@proofloop/shared';
import { User, type UserDoc } from '../models/User';
import { BadRequestException, ResourceNotFoundException } from '../utils/errors';

export async function listUsers() {
  const users = await User.find().sort({ createdAt: 1 });
  return users.map((u) => u.toJSON());
}

// The only way to grant REVIEWER/ADMIN; self-registration always yields USER.
export async function updateRole(actingAdmin: UserDoc, userId: string, role: Role) {
  if (actingAdmin.id === userId) {
    throw new BadRequestException('You cannot change your own role');
  }
  const user = await User.findById(userId).catch(() => null);
  if (!user) throw new ResourceNotFoundException('User not found');

  user.role = role;
  await user.save();
  return user.toJSON();
}
