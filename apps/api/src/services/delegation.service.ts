import type { CreateDelegationInput, MyDelegations } from '@proofloop/shared';
import { Delegation, type DelegationDoc } from '../models/Delegation';
import { User, type UserDoc } from '../models/User';
import {
  AccessDeniedException,
  BadRequestException,
  ConflictException,
  ResourceNotFoundException,
} from '../utils/errors';

const MAX_DELEGATION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function createDelegation(from: UserDoc, { toEmail, endsAt, note }: CreateDelegationInput) {
  const to = await User.findOne({ email: toEmail });
  if (!to) throw new ResourceNotFoundException('No user with that email');
  if (to.id === from.id) throw new BadRequestException('You cannot delegate to yourself');

  const now = new Date();
  const end = new Date(endsAt);
  if (end.getTime() <= now.getTime()) throw new BadRequestException('End date must be in the future');
  if (end.getTime() - now.getTime() > MAX_DELEGATION_DAYS * DAY_MS) {
    throw new BadRequestException(`A delegation can last at most ${MAX_DELEGATION_DAYS} days`);
  }

  const existing = await Delegation.exists({ fromUserId: from.id, revokedAt: null, endsAt: { $gt: now } });
  if (existing) throw new ConflictException('You already have an active delegation. End it before creating another.');

  const delegation = await Delegation.create({
    fromUserId: from.id,
    fromUserName: from.name,
    toUserId: to.id,
    toUserName: to.name,
    role: from.role,
    startsAt: now,
    endsAt: end,
    note,
  });
  return delegation.toJSON();
}

export async function listMyDelegations(user: UserDoc): Promise<MyDelegations> {
  const [given, received] = await Promise.all([
    Delegation.find({ fromUserId: user.id }).sort({ createdAt: -1 }).limit(20),
    Delegation.find({ toUserId: user.id }).sort({ createdAt: -1 }).limit(20),
  ]);
  return {
    given: given.map((d) => d.toJSON()),
    received: received.map((d) => d.toJSON()),
  } as unknown as MyDelegations;
}

/** The delegator (or an admin) can end a delegation early. */
export async function revokeDelegation(user: UserDoc, id: string) {
  const delegation = await Delegation.findById(id).catch(() => null);
  if (!delegation) throw new ResourceNotFoundException('Delegation not found');
  if (delegation.fromUserId !== user.id && user.role !== 'ADMIN') {
    throw new AccessDeniedException('Only the person who delegated can end this delegation');
  }
  if (!delegation.revokedAt) {
    delegation.revokedAt = new Date();
    await delegation.save();
  }
  return delegation.toJSON();
}

/**
 * Delegations currently letting `user` approve for someone else. A delegation
 * only counts while its delegator still holds the delegated role, so demoting
 * someone also withdraws what they delegated.
 */
export async function activeDelegationsTo(user: UserDoc): Promise<DelegationDoc[]> {
  const now = new Date();
  const delegations = await Delegation.find({
    toUserId: user.id,
    revokedAt: null,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  }).sort({ createdAt: 1 });
  if (delegations.length === 0) return [];

  const delegators = await User.find({ _id: { $in: delegations.map((d) => d.fromUserId) } });
  const currentRole = new Map(delegators.map((u) => [u.id as string, u.role]));
  return delegations.filter((d) => currentRole.get(d.fromUserId) === d.role);
}
