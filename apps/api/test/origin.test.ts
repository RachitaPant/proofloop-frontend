import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'vitest';
import { isAllowedOrigin } from '../src/middleware/origin';

describe('isAllowedOrigin', () => {
  const original = process.env.CORS_ALLOWED_ORIGINS;
  afterEach(() => {
    process.env.CORS_ALLOWED_ORIGINS = original;
  });

  test('exact entries match exactly', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://proofloop-frontend.vercel.app, http://localhost:3000';
    assert.equal(isAllowedOrigin('https://proofloop-frontend.vercel.app'), true);
    assert.equal(isAllowedOrigin('http://localhost:3000'), true);
    assert.equal(isAllowedOrigin('https://proofloop-frontend.vercel.app.evil.com'), false);
    assert.equal(isAllowedOrigin('http://localhost:3001'), false);
  });

  test('a wildcard matches one domain label and nothing more', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://proofloop-frontend-*-rachitapants-projects.vercel.app';
    assert.equal(isAllowedOrigin('https://proofloop-frontend-git-phase-1-rachitapants-projects.vercel.app'), true);
    assert.equal(isAllowedOrigin('https://proofloop-frontend-abc123-rachitapants-projects.vercel.app'), true);
    // can't reach into another domain or label
    assert.equal(isAllowedOrigin('https://proofloop-frontend-x.evil.com-rachitapants-projects.vercel.app'), false);
    assert.equal(isAllowedOrigin('https://proofloop-frontend-x-rachitapants-projects.vercel.app.evil.com'), false);
    assert.equal(isAllowedOrigin('http://proofloop-frontend-x-rachitapants-projects.vercel.app'), false);
  });

  test('regex metacharacters in entries are literal', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://a.b.com';
    assert.equal(isAllowedOrigin('https://aXb.com'), false);
  });
});
