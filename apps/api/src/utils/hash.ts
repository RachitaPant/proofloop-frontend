import crypto from 'node:crypto';

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
}

export function computeHash({ stepIndex, action, actedBy, comment, timestamp, previousHash, onBehalfOf }: HashInput): string {
  const parts: (string | number)[] = [stepIndex, action, actedBy, comment || '', timestamp, previousHash];
  if (onBehalfOf) parts.push(`onBehalfOf:${onBehalfOf}`);
  const data = parts.join('|');
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}
