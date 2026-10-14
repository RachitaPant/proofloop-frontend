import { Schema, model } from 'mongoose';

// Counters that cap AI spend: one bucket per user per hour, plus one global
// bucket per day. Buckets expire on their own (TTL index).
interface IAiUsage {
  bucket: string;
  count: number;
  expiresAt: Date;
}

const aiUsageSchema = new Schema<IAiUsage>(
  {
    bucket: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'ai_usage' },
);
aiUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AiUsage = model<IAiUsage>('AiUsage', aiUsageSchema);
