import crypto from 'node:crypto';
import type { AiRecommendation } from '@proofloop/shared';

// SHA-256 hash chain over each audit action: every entry commits to the
// previous entry's hash, so editing or removing history breaks the chain.
export const GENESIS_HASH = '0'.repeat(64);

export interface HashInput {
  stepIndex: number;
  action: string;
  actedBy: string;
  comment?: string | null;
  timestamp: string;
  previousHash: string;
  /** Delegator id when a delegate acted. Only appended when present, so
   *  entries recorded before delegation existed still verify. */
  onBehalfOf?: string | null;
  /** Digest of an AI recommendation (see aiDigest). Only appended when
   *  present, so entries recorded before the copilot existed still verify. */
  aiDigest?: string | null;
}

export function computeHash({
  stepIndex,
  action,
  actedBy,
  comment,
  timestamp,
  previousHash,
  onBehalfOf,
  aiDigest: ai,
}: HashInput): string {
  const parts: (string | number)[] = [stepIndex, action, actedBy, comment || '', timestamp, previousHash];
  if (onBehalfOf) parts.push(`onBehalfOf:${onBehalfOf}`);
  if (ai) parts.push(`ai:${ai}`);
  const data = parts.join('|');
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Digest of everything an AI entry claims (model, prompt version, who asked,
 * the full recommendation), so none of it can change after the fact without
 * breaking the chain. Fields are picked in a fixed order rather than hashing
 * the stored object, so the digest doesn't depend on key order or on what the
 * database adds.
 */
export function aiDigest(ai: AiRecommendation): string {
  const canonical = JSON.stringify([
    ai.model,
    ai.promptVersion,
    ai.requestedBy,
    ai.requestedByName,
    ai.basedOnEntries,
    ai.summary,
    ai.checks.map((c) => [c.name, c.result, c.detail]),
    ai.concerns,
    ai.missingInformation,
    ai.recommendation,
    ai.confidence,
    ai.rationale,
  ]);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}
