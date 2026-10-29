// Shared setup for integration test files: an in-memory MongoDB, the Express
// app, and helpers to create users, workflows and requests over HTTP.
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import supertest from 'supertest';
import type { CreateWorkflowPayload, Role } from '@proofloop/shared';

export interface Harness {
  api: ReturnType<typeof supertest>;
  ids: Record<string, string>;
  auth: (key: string) => { Authorization: string };
  /** Creates a new organisation whose owner (an ADMIN) is `key`. */
  registerOwner: (key: string, organizationName: string) => Promise<void>;
  /** Joins `ownerKey`'s organisation (default: the main test org) through an invite. */
  registerAs: (key: string, role: Role, ownerKey?: string) => Promise<void>;
  createWorkflow: (key: string, workflow: Omit<CreateWorkflowPayload, 'name'> & { name?: string }) => Promise<any>;
  createRequest: (key: string, workflowId: string, fields?: Record<string, string | number>) => Promise<any>;
  stop: () => Promise<void>;
}

export async function startHarness(): Promise<Harness> {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DATABASE = 'proofloop-test';
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  process.env.AUTH_RATE_LIMIT = '1000';
  process.env.NODE_ENV = 'test';

  const app = (await import('../src/app')).default;
  const api = supertest(app);
  await (await import('../src/config/db')).connectDB();

  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const auth = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` });

  // Every organisation starts with a self-registered owner (an ADMIN)...
  const registerOwner = async (key: string, organizationName: string) => {
    const res = await api
      .post('/api/auth/register')
      .send({ name: key, email: `${key}@test.dev`, password: 'password123', organizationName })
      .expect(200);
    ids[key] = res.body.id;
    tokens[key] = res.body.token;
  };
  await registerOwner('admin', 'Test Org');

  // ...and everyone else joins through a real invite.
  const registerAs = async (key: string, role: Role, ownerKey = 'admin') => {
    const email = `${key}@test.dev`;
    const invite = await api.post('/api/admin/invites').set(auth(ownerKey)).send({ email, role }).expect(201);
    const res = await api
      .post('/api/auth/register')
      .send({ name: key, email, password: 'password123', inviteToken: invite.body.token })
      .expect(200);
    ids[key] = res.body.id;
    tokens[key] = res.body.token;
  };

  const createWorkflow: Harness['createWorkflow'] = async (key, workflow) => {
    const res = await api
      .post('/api/workflows')
      .set(auth(key))
      .send({ name: `wf-${Date.now()}`, ...workflow });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body;
  };

  const createRequest: Harness['createRequest'] = async (key, workflowId, fields = {}) => {
    const res = await api.post('/api/requests').set(auth(key)).send({ title: 'Test request', workflowId, fields });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body;
  };

  return {
    api,
    ids,
    auth,
    registerOwner,
    registerAs,
    createWorkflow,
    createRequest,
    stop: async () => {
      await mongoose.disconnect();
      await mongo.stop();
    },
  };
}

export const step = (stepName: string, requiredRole: Role, extra: Record<string, unknown> = {}) => ({
  stepIndex: 0,
  stepName,
  requiredRole,
  ...extra,
});
