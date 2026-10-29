import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Role } from '@proofloop/shared';

// A single-use link that lets one email address sign up into an organisation
// with a given role. Only a SHA-256 hash of the token is stored; the raw token is
// shown once, to the admin who created it.
export interface IInvite {
  orgId: string;
  tokenHash: string;
  role: Role;
  /** Lower-cased. Only this address may use the invite. */
  email: string;
  createdBy: string;
  createdByName: string;
  expiresAt: Date;
  usedAt?: Date | null;
  usedBy?: string | null;
  revokedAt?: Date | null;
  createdAt: Date;
}

const inviteSchema = new Schema<IInvite>(
  {
    orgId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    role: { type: String, enum: ['USER', 'REVIEWER', 'ADMIN'], required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: String, default: null },
    revokedAt: { type: Date, default: null },
  },
  {
    collection: 'invites',
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.tokenHash;
        return ret;
      },
    },
  },
);

inviteSchema.index({ orgId: 1, email: 1 });

export type InviteDoc = HydratedDocument<IInvite>;
export const Invite = model<IInvite>('Invite', inviteSchema);
