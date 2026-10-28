// A small client for any OpenAI-compatible chat-completions API (Groq,
// OpenRouter, Google Gemini's compatibility endpoint, Together, a local
// Ollama/vLLM server...). No vendor SDK: one POST per call, so switching
// provider is three environment variables:
//
//   AI_API_KEY   the provider's key (feature is off without it)
//   AI_BASE_URL  e.g. https://api.groq.com/openai/v1 (default)
//   AI_MODEL     e.g. openai/gpt-oss-120b (default)
//
// Optional: AI_JSON_MODE=object for providers/models without JSON-schema
// output, AI_REASONING_EFFORT=low|medium|high for reasoning models that take it.

export const AI_BASE_URL = () => (process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
export const AI_MODEL = () => process.env.AI_MODEL || 'openai/gpt-oss-120b';

export interface LlmRequest {
  system: string;
  user: string;
  /** JSON Schema the reply should follow (used when the provider supports it). */
  schema: Record<string, unknown>;
  /** Name for the schema in the provider request (snake_case); defaults to a generic one. */
  schemaName?: string;
  /** A previous bad reply to repair, with what was wrong with it. */
  repair?: { reply: string; problem: string };
}

export interface LlmReply {
  text: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmReply>;
}

/** Thrown for provider failures; `status` is the HTTP status when there was one. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

let override: LlmClient | null = null;

/** Tests only. Pass null to restore the real client. */
export function setLlmClientForTests(client: LlmClient | null) {
  override = client;
}

export function isAiEnabled(): boolean {
  return override !== null || Boolean(process.env.AI_API_KEY);
}

// Some free models reject json_schema output. After the first such rejection
// this instance stops asking for it (plain JSON mode + the schema in the prompt).
let schemaUnsupported = false;

class HttpLlmClient implements LlmClient {
  async complete(request: LlmRequest): Promise<LlmReply> {
    const useSchema = process.env.AI_JSON_MODE !== 'object' && !schemaUnsupported;
    try {
      return await this.call(request, useSchema);
    } catch (err) {
      // 400 usually means "this model can't do json_schema": retry once without it.
      if (useSchema && err instanceof LlmError && err.status === 400) {
        console.warn('AI provider rejected json_schema output; falling back to JSON mode');
        schemaUnsupported = true;
        return this.call(request, false);
      }
      throw err;
    }
  }

  private async call({ system, user, schema, schemaName, repair }: LlmRequest, useSchema: boolean): Promise<LlmReply> {
    const messages: { role: string; content: string }[] = [
      {
        role: 'system',
        // Without schema enforcement the model needs the shape spelled out.
        content: useSchema
          ? system
          : `${system}\n\nReply with a single JSON object (no prose, no code fences) matching this JSON Schema:\n${JSON.stringify(schema)}`,
      },
      { role: 'user', content: user },
    ];
    if (repair) {
      messages.push(
        { role: 'assistant', content: repair.reply },
        { role: 'user', content: `That reply was not usable: ${repair.problem}\nReturn the corrected JSON object only.` },
      );
    }

    const body: Record<string, unknown> = {
      model: AI_MODEL(),
      messages,
      temperature: 0.2,
      max_tokens: 6000,
      response_format: useSchema
        ? { type: 'json_schema', json_schema: { name: schemaName ?? 'structured_output', strict: true, schema } }
        : { type: 'json_object' },
    };
    if (process.env.AI_REASONING_EFFORT) body.reasoning_effort = process.env.AI_REASONING_EFFORT;

    let res: Response;
    try {
      res = await fetch(`${AI_BASE_URL()}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` },
        body: JSON.stringify(body),
        // Stays under the serverless function limit (see vercel.json).
        signal: AbortSignal.timeout(45_000),
      });
    } catch (err) {
      throw new LlmError(`network error: ${(err as Error).message}`);
    }

    if (!res.ok) {
      // The body can carry useful provider detail; it's logged by the caller, never returned to users.
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new LlmError(`provider returned ${res.status}: ${detail}`, res.status);
    }

    const json = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      usage?: LlmReply['usage'];
    } | null;
    const choice = json?.choices?.[0];
    if (choice?.finish_reason === 'length') throw new LlmError('reply was cut off (max tokens)');
    const text = choice?.message?.content;
    if (!text) throw new LlmError('provider returned no content');
    return { text, usage: json?.usage };
  }
}

let cached: LlmClient | null = null;
export function getLlmClient(): LlmClient {
  return override ?? (cached ??= new HttpLlmClient());
}
