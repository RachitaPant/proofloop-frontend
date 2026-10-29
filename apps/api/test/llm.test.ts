// The provider-neutral HTTP client, tested against a stubbed fetch (no network).
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test, vi } from 'vitest';

type Fetch = typeof fetch;
const schema = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false };
const request = { system: 'You draft workflows.', user: 'make one', schema, schemaName: 'review_output' };

const reply = (content: string | null, extra: Record<string, unknown> = {}, status = 200) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: 'stop', ...extra }],
      usage: { prompt_tokens: 5, completion_tokens: 7 },
    }),
    { status },
  );

// The client keeps a "this provider can't do json_schema" flag in module state,
// so each test gets a fresh copy of the module.
async function load() {
  vi.resetModules();
  return import('../src/config/llm');
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock as unknown as Fetch);
  process.env.AI_API_KEY = 'test-key';
  delete process.env.AI_BASE_URL;
  delete process.env.AI_MODEL;
  delete process.env.AI_JSON_MODE;
  delete process.env.AI_REASONING_EFFORT;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_API_KEY;
});

const sentBody = (call: number) => JSON.parse((fetchMock.mock.calls[call]![1] as RequestInit).body as string);

describe('OpenAI-compatible client', () => {
  test('posts a strict json_schema request to the configured provider and returns text + usage', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"a":"x"}'));
    const { getLlmClient } = await load();
    const out = await getLlmClient().complete(request);

    assert.deepEqual(out, { text: '{"a":"x"}', usage: { prompt_tokens: 5, completion_tokens: 7 } });
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer test-key');
    const body = sentBody(0);
    assert.equal(body.model, 'openai/gpt-oss-120b');
    assert.deepEqual(body.messages.map((m: { role: string }) => m.role), ['system', 'user']);
    assert.deepEqual(body.response_format, {
      type: 'json_schema',
      json_schema: { name: 'review_output', strict: true, schema },
    });
    assert.equal(body.reasoning_effort, undefined);
  });

  test('base URL, model and reasoning effort come from the environment', async () => {
    process.env.AI_BASE_URL = 'https://openrouter.ai/api/v1/';
    process.env.AI_MODEL = 'some/free-model:free';
    process.env.AI_REASONING_EFFORT = 'low';
    fetchMock.mockResolvedValueOnce(reply('{}'));
    const { getLlmClient } = await load();
    await getLlmClient().complete(request);
    assert.equal(fetchMock.mock.calls[0]![0], 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(sentBody(0).model, 'some/free-model:free');
    assert.equal(sentBody(0).reasoning_effort, 'low');
  });

  test('a repair request replays the bad reply and says what was wrong', async () => {
    fetchMock.mockResolvedValueOnce(reply('{}'));
    const { getLlmClient } = await load();
    await getLlmClient().complete({ ...request, repair: { reply: '{oops', problem: 'it was not valid JSON' } });
    const messages = sentBody(0).messages as { role: string; content: string }[];
    assert.deepEqual(messages.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
    assert.equal(messages[2]!.content, '{oops');
    assert.match(messages[3]!.content, /not valid JSON/);
  });

  test('AI_JSON_MODE=object skips json_schema and puts the schema in the prompt instead', async () => {
    process.env.AI_JSON_MODE = 'object';
    fetchMock.mockResolvedValueOnce(reply('{}'));
    const { getLlmClient } = await load();
    await getLlmClient().complete(request);
    assert.deepEqual(sentBody(0).response_format, { type: 'json_object' });
    assert.match(sentBody(0).messages[0].content, /JSON Schema/);
    assert.ok(sentBody(0).messages[0].content.includes('"additionalProperties":false'));
  });

  test('if the provider rejects json_schema (400), it retries in JSON mode and remembers', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"error":"response_format json_schema not supported"}', { status: 400 }))
      .mockResolvedValueOnce(reply('{"a":"x"}'))
      .mockResolvedValueOnce(reply('{"a":"y"}'));
    const { getLlmClient } = await load();
    const client = getLlmClient();

    assert.equal((await client.complete(request)).text, '{"a":"x"}');
    assert.equal(sentBody(0).response_format.type, 'json_schema');
    assert.equal(sentBody(1).response_format.type, 'json_object');

    await client.complete(request);
    assert.equal(fetchMock.mock.calls.length, 3, 'the next call went straight to JSON mode');
    assert.equal(sentBody(2).response_format.type, 'json_object');
  });

  test('provider failures become LlmError with the status, and bad bodies are rejected', async () => {
    const { getLlmClient, LlmError } = await load();
    const client = getLlmClient();

    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    await assert.rejects(client.complete(request), (e: unknown) => e instanceof LlmError && e.status === 429);

    fetchMock.mockResolvedValueOnce(reply('{"a":', { finish_reason: 'length' }));
    await assert.rejects(client.complete(request), /cut off/);

    fetchMock.mockResolvedValueOnce(reply(null));
    await assert.rejects(client.complete(request), /no content/);

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await assert.rejects(client.complete(request), (e: unknown) => e instanceof LlmError && e.status === undefined);
  });
});
