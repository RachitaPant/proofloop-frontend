import type { Role } from '@proofloop/shared';
import { User, type UserDoc } from '../models/User';
import { AccessDeniedException, BadRequestException, ResourceNotFoundException } from '../utils/errors';

export async function listUsers(admin: UserDoc) {
  const users = await User.find({ orgId: admin.orgId }).sort({ createdAt: 1 });
  return users.map((u) => u.toJSON());
}

// The only way to grant REVIEWER/ADMIN: self-registration creates an owner of
// a new organisation or takes the role an invite carries. Admins manage USER
// and REVIEWER; granting or taking away ADMIN, and touching the owner, is for
// the owner alone (and nobody can change the owner's role).
export async function updateRole(actingAdmin: UserDoc, userId: string, role: Role) {
  if (actingAdmin.id === userId) {
    throw new BadRequestException('You cannot change your own role');
  }
  const user = await User.findOne({ _id: userId, orgId: actingAdmin.orgId }).catch(() => null);
  if (!user) throw new ResourceNotFoundException('User not found');
  if (user.isOwner) throw new AccessDeniedException("The organisation owner's role cannot be changed");
  if ((role === 'ADMIN' || user.role === 'ADMIN') && !actingAdmin.isOwner) {
    throw new AccessDeniedException('Only the organisation owner can grant or remove the admin role');
  }

  user.role = role;
  await user.save();
  return user.toJSON();
}
