import { Schema, model, type HydratedDocument } from 'mongoose';

// One row per issued refresh token. Only a SHA-256 hash of the token is
// stored, so a database leak doesn't leak usable sessions. Tokens rotate on
// every refresh; all tokens descended from one login share a familyId, which
// lets reuse of an already-rotated token revoke the whole chain.
export interface IRefreshToken {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  userAgent?: string;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: String, required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String },
  },
  { collection: 'refresh_tokens', timestamps: { createdAt: true, updatedAt: false } },
);

// MongoDB deletes expired tokens on its own.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = HydratedDocument<IRefreshToken>;
export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
