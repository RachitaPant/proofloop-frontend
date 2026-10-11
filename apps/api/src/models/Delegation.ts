import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Role } from '@proofloop/shared';

// "While I'm away, <to> may approve in my place." Scoped to approval steps
// only (it never grants admin API access), time-boxed, and revocable. The
// delegator's role is snapshotted, and the delegation only counts while the
// delegator still holds that role.
export interface IDelegation {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  role: Role;
  startsAt: Date;
  endsAt: Date;
  revokedAt?: Date | null;
  note?: string | null;
  createdAt: Date;
}

const delegationSchema = new Schema<IDelegation>(
  {
    fromUserId: { type: String, required: true, index: true },
    fromUserName: { type: String, required: true },
    toUserId: { type: String, required: true, index: true },
    toUserName: { type: String, required: true },
    role: { type: String, enum: ['USER', 'REVIEWER', 'ADMIN'], required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    note: { type: String },
  },
  {
    collection: 'delegations',
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        const now = Date.now();
        ret.active =
          !ret.revokedAt && (ret.startsAt as Date).getTime() <= now && (ret.endsAt as Date).getTime() > now;
        return ret;
      },
    },
  },
);

export type DelegationDoc = HydratedDocument<IDelegation>;
export const Delegation = model<IDelegation>('Delegation', delegationSchema);
