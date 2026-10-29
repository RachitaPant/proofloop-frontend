import bcrypt from 'bcryptjs';
import type { AuthResponse, InvitePreview, LoginInput, RegisterInput } from '@proofloop/shared';
import { Invite } from '../models/Invite';
import { Organization } from '../models/Organization';
import { User, type UserDoc } from '../models/User';
import { generateToken } from '../utils/jwt';
import { BadRequestException, ValidationException } from '../utils/errors';
import { hashInviteToken } from './org.service';

// The bearer token in the body serves API clients. The web app ignores it and
// relies on the httpOnly cookies set by the route (see session.service).
export function toAuthResponse(user: UserDoc): AuthResponse {
  return {
    token: generateToken(user.email, user.role),
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
    isOwner: Boolean(user.isOwner),
  };
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const liveInvite = (token: string) => ({
  tokenHash: hashInviteToken(token),
  usedAt: null,
  revokedAt: null,
  expiresAt: { $gt: new Date() },
});

// Every account belongs to one organisation, and the client never picks its
// role. There are two ways in:
//  - accept an invite: you join that organisation with the role it carries,
//    and only the invited email address may use it;
//  - create an organisation: you become its owner (ADMIN, the super admin).
export async function register({ name, email, password, inviteToken, organizationName }: RegisterInput): Promise<UserDoc> {
  const address = normalizeEmail(email);
  const orgName = organizationName?.trim();
  if (inviteToken && orgName) {
    throw new BadRequestException('Either accept an invite or create an organisation, not both');
  }
  if (!inviteToken && !orgName) {
    throw new ValidationException({ organizationName: 'Name your organisation' });
  }
  if (await User.exists({ email: address })) {
    throw new BadRequestException('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  return inviteToken
    ? joinWithInvite({ name, address, passwordHash, inviteToken })
    : createOrganization({ name, address, passwordHash, orgName: orgName! });
}

async function createOrganization(input: { name: string; address: string; passwordHash: string; orgName: string }) {
  const org = await Organization.create({ name: input.orgName });
  try {
    const owner = await User.create({
      name: input.name,
      email: input.address,
      passwordHash: input.passwordHash,
      role: 'ADMIN',
      isOwner: true,
      orgId: org.id,
    });
    org.createdBy = owner.id;
    await org.save();
    return owner;
  } catch (err) {
    await org.deleteOne();
    throw err;
  }
}

async function joinWithInvite(input: { name: string; address: string; passwordHash: string; inviteToken: string }) {
  const peek = await Invite.findOne(liveInvite(input.inviteToken));
  if (!peek) throw new BadRequestException('This invite is invalid, expired or already used');
  if (peek.email !== input.address) {
    throw new BadRequestException(`This invite was sent to a different email address${hint(peek.email)}`);
  }

  // Claim atomically so one link can't create two accounts.
  const invite = await Invite.findOneAndUpdate(liveInvite(input.inviteToken), { $set: { usedAt: new Date() } });
  if (!invite) throw new BadRequestException('This invite is invalid, expired or already used');

  try {
    const user = await User.create({
      name: input.name,
      email: input.address,
      passwordHash: input.passwordHash,
      role: invite.role,
      orgId: invite.orgId,
    });
    invite.usedBy = user.id;
    await invite.save();
    return user;
  } catch (err) {
    await Invite.updateOne({ _id: invite._id }, { $set: { usedAt: null } });
    throw err;
  }
}

/** "a***@gmail.com": enough for the invitee to recognise their address. */
function hint(email: string) {
  const [local = '', domain = ''] = email.split('@');
  return ` (${local.slice(0, 1)}***@${domain})`;
}

/** What the join page shows. Invalid, used and expired links look identical. */
export async function previewInvite(token: string): Promise<InvitePreview> {
  const invite = await Invite.findOne(liveInvite(token));
  if (!invite) return { valid: false };
  const org = await Organization.findById(invite.orgId);
  if (!org) return { valid: false };
  return { valid: true, orgName: org.name, role: invite.role, email: invite.email };
}

export async function login({ email, password }: LoginInput): Promise<UserDoc> {
  // Older accounts may have been stored with the capitalisation typed at sign-up.
  const user = await User.findOne({ email: { $in: [normalizeEmail(email), email.trim()] } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new BadRequestException('Invalid credentials');
  }
  return user;
}
