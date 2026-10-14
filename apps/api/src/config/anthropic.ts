import Anthropic from '@anthropic-ai/sdk';

// The model is configurable so cost can be tuned without a code change.
// claude-opus-5-5 is the default; a cheaper option is claude-sonnet-5-5.
export const AI_MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

/** Minimal surface the AI service uses, so tests can substitute a fake. */
export type AiClient = Pick<Anthropic, 'messages'>;

let override: AiClient | null = null;
let cached: Anthropic | null = null;

/** Tests only. Pass null to restore the real client. */
export function setAiClientForTests(client: AiClient | null) {
  override = client;
}

export function isAiEnabled(): boolean {
  return override !== null || Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAiClient(): AiClient {
  if (override) return override;
  // Timeout stays under the serverless function limit (see vercel.json).
  cached ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 45_000 });
  return cached;
}
