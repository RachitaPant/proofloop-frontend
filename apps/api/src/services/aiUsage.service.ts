import { AiUsage } from '../models/AiUsage';
import { TooManyRequestsException } from '../utils/errors';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const perUserPerHour = () => Number(process.env.AI_REQUESTS_PER_HOUR || 10);
const globalPerDay = () => Number(process.env.AI_DAILY_CAP || 200);

async function take(bucket: string, limit: number, ttlMs: number): Promise<number> {
  const doc = await AiUsage.findOneAndUpdate(
    { bucket },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + ttlMs) } },
    { upsert: true, new: true },
  );
  return limit - doc.count;
}

async function give(bucket: string) {
  await AiUsage.updateOne({ bucket }, { $inc: { count: -1 } });
}

/**
 * Reserves one AI request for this user, atomically (counters live in the
 * database, so the limits hold across serverless instances). Returns how many
 * requests the user has left this hour. Call `refund` if the request fails
 * before reaching the model, so errors don't burn the allowance.
 */
export async function reserveAiRequest(userId: string) {
  const now = new Date();
  const hourBucket = `user:${userId}:${now.toISOString().slice(0, 13)}`;
  const dayBucket = `global:${now.toISOString().slice(0, 10)}`;

  const dayLeft = await take(dayBucket, globalPerDay(), 2 * DAY_MS);
  if (dayLeft < 0) {
    await give(dayBucket);
    throw new TooManyRequestsException('AI drafting has reached its daily limit. Try again tomorrow.');
  }

  const hourLeft = await take(hourBucket, perUserPerHour(), 2 * HOUR_MS);
  if (hourLeft < 0) {
    await Promise.all([give(hourBucket), give(dayBucket)]);
    throw new TooManyRequestsException(`You can generate ${perUserPerHour()} AI drafts per hour. Try again later.`);
  }

  return {
    remainingThisHour: hourLeft,
    refund: () => Promise.all([give(hourBucket), give(dayBucket)]).then(() => undefined),
  };
}
