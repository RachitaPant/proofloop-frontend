import crypto from 'node:crypto';
import type { CreatedInvite, CreateInviteInput, Invite as InviteView, Organization as OrganizationView } from '@proofloop/shared';
import { Organization } from '../models/Organization';
import { Invite, type InviteDoc } from '../models/Invite';
import { User, type UserDoc } from '../models/User';
import { ApproverGroup } from '../models/ApproverGroup';
import { Delegation } from '../models/Delegation';
import { RefreshToken } from '../models/RefreshToken';
import {
  AccessDeniedException,
  BadRequestException,
  ConflictException,
  ResourceNotFoundException,
} from '../utils/errors';
import { buildInviteEmail } from './inviteEmail';
import { sendMail } from './mailer.service';

export const INVITE_TTL_DAYS = 7;
// Bounds how many emails one organisation can trigger without anyone joining.
const MAX_PENDING_INVITES = 50;

export const hashInviteToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

const pendingFilter = (orgId: string) => ({ orgId, usedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } });

export async function getOrganization(user: UserDoc): Promise<OrganizationView> {
  const [org, memberCount] = await Promise.all([
    Organization.findById(user.orgId),
    User.countDocuments({ orgId: user.orgId }),
  ]);
  if (!org) throw new ResourceNotFoundException('Organisation not found');
  return { id: org.id, name: org.name, memberCount, createdAt: org.createdAt.toISOString() };
}

export async function renameOrganization(owner: UserDoc, name: string): Promise<OrganizationView> {
  await Organization.updateOne({ _id: owner.orgId }, { $set: { name } });
  return getOrganization(owner);
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function listInvites(admin: UserDoc): Promise<InviteView[]> {
  const invites = await Invite.find(pendingFilter(admin.orgId)).sort({ createdAt: -1 });
  return invites.map((i) => i.toJSON() as unknown as InviteView);
}

async function deliver(admin: UserDoc, invite: InviteDoc, token: string, baseUrl: string): Promise<CreatedInvite> {
  const org = await Organization.findById(admin.orgId);
  const link = `${baseUrl}/join?token=${encodeURIComponent(token)}`;
  const emailStatus = await sendMail(
    buildInviteEmail({
      to: invite.email,
      orgName: org?.name ?? 'your organisation',
      inviterName: admin.name,
      role: invite.role,
      link,
      expiresAt: invite.expiresAt,
    }),
  );
  return { ...(invite.toJSON() as unknown as InviteView), token, link, emailStatus };
}

/**
 * Invites one email address. The email is a convenience: the response always
 * carries the link, so an owner can share it themselves if delivery fails or
 * no mail provider is configured.
 */
export async function createInvite(admin: UserDoc, { email, role }: CreateInviteInput, baseUrl: string) {
  if (role === 'ADMIN' && !admin.isOwner) {
    throw new AccessDeniedException('Only the organisation owner can invite admins');
  }
  const address = email.trim().toLowerCase();
  if (await User.exists({ email: address })) {
    throw new ConflictException('That email already has a ProofLoop account');
  }
  if ((await Invite.countDocuments(pendingFilter(admin.orgId))) >= MAX_PENDING_INVITES) {
    throw new BadRequestException(`You have ${MAX_PENDING_INVITES} pending invites; revoke some before sending more`);
  }

  // One live invite per address: sending again replaces the earlier link.
  await Invite.updateMany({ ...pendingFilter(admin.orgId), email: address }, { $set: { revokedAt: new Date() } });

  const token = crypto.randomBytes(32).toString('base64url');
  const invite = await Invite.create({
    orgId: admin.orgId,
    tokenHash: hashInviteToken(token),
    role,
    email: address,
    createdBy: admin.id,
    createdByName: admin.name,
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  return deliver(admin, invite, token, baseUrl);
}

async function findPendingInvite(admin: UserDoc, id: string) {
  const invite = await Invite.findOne({ _id: id, ...pendingFilter(admin.orgId) }).catch(() => null);
  if (!invite) throw new ResourceNotFoundException('Invite not found');
  return invite;
}

/** New link and a fresh expiry (the old link stops working), then email it again. */
export async function resendInvite(admin: UserDoc, id: string, baseUrl: string) {
  const invite = await findPendingInvite(admin, id);
  if (invite.role === 'ADMIN' && !admin.isOwner) {
    throw new AccessDeniedException('Only the organisation owner can manage admin invites');
  }
  const token = crypto.randomBytes(32).toString('base64url');
  invite.tokenHash = hashInviteToken(token);
  invite.expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await invite.save();
  return deliver(admin, invite, token, baseUrl);
}

export async function revokeInvite(admin: UserDoc, id: string) {
  const invite = await findPendingInvite(admin, id);
  if (invite.role === 'ADMIN' && !admin.isOwner) {
    throw new AccessDeniedException('Only the organisation owner can manage admin invites');
  }
  invite.revokedAt = new Date();
  await invite.save();
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/**
 * Removes someone from the organisation. Their past actions stay in audit
 * trails (those store the name), but they can no longer sign in, belong to no
 * approver group, and anything they delegated ends.
 */
export async function removeMember(admin: UserDoc, userId: string) {
  const member = await User.findOne({ _id: userId, orgId: admin.orgId }).catch(() => null);
  if (!member) throw new ResourceNotFoundException('User not found');
  if (member.id === admin.id) throw new BadRequestException('You cannot remove yourself');
  if (member.isOwner) throw new AccessDeniedException('The organisation owner cannot be removed');
  if (member.role === 'ADMIN' && !admin.isOwner) {
    throw new AccessDeniedException('Only the organisation owner can remove admins');
  }

  const now = new Date();
  await Promise.all([
    RefreshToken.deleteMany({ userId: member.id }),
    ApproverGroup.updateMany({ orgId: admin.orgId }, { $pull: { memberIds: member.id } }),
    Delegation.updateMany(
      { orgId: admin.orgId, revokedAt: null, $or: [{ fromUserId: member.id }, { toUserId: member.id }] },
      { $set: { revokedAt: now } },
    ),
  ]);
  await member.deleteOne();
}
