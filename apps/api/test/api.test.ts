// Integration tests for the API against an in-memory MongoDB. Run: pnpm test
import assert from 'node:assert/strict';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import type { Role } from '@proofloop/shared';

type Models = {
  User: typeof import('../src/models/User').User;
  Workflow: typeof import('../src/models/Workflow').Workflow;
  Request: typeof import('../src/models/Request').Request;
};

let mongo: MongoMemoryServer;
let api: ReturnType<typeof supertest>;
let m: Models;
let requestService: typeof import('../src/services/request.service');

const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};

const auth = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` });

async function login(email: string, password: string) {
  const res = await api.post('/api/auth/login').send({ email, password }).expect(200);
  return res.body as { token: string; id: string; role: Role };
}

async function registerAs(key: string, role: Role) {
  const email = `${key}@test.dev`;
  const res = await api.post('/api/auth/register').send({ name: key, email, password: 'password123' }).expect(200);
  ids[key] = res.body.id;
  if (role !== 'USER') {
    await api.patch(`/api/admin/users/${res.body.id}/role`).set(auth('admin')).send({ role }).expect(200);
  }
  tokens[key] = (await login(email, 'password123')).token;
}

type StepSpec = { requiredRole: Role; requiredApprovals?: number; slaHours?: number };

async function createWorkflow(key: string, steps: StepSpec[]) {
  const res = await api
    .post('/api/workflows')
    .set(auth(key))
    .send({ name: `wf-${Date.now()}`, steps: steps.map((s, i) => ({ stepIndex: i, stepName: `Step ${i}`, ...s })) })
    .expect(200);
  return res.body as { id: string };
}

async function createRequest(key: string, workflowId: string) {
  const res = await api.post('/api/requests').set(auth(key)).send({ title: 'Test request', workflowId }).expect(200);
  return res.body as { id: string; stepStartTimes: Record<string, string> };
}

async function loadUser(key: string) {
  const user = await m.User.findById(ids[key]);
  assert.ok(user);
  return user;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DATABASE = 'proofloop-test';
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  process.env.AUTH_RATE_LIMIT = '1000';
  process.env.NODE_ENV = 'test';

  // Imported after the env is set: app.ts reads CORS/rate-limit config at load.
  const app = (await import('../src/app')).default;
  api = supertest(app);
  m = {
    User: (await import('../src/models/User')).User,
    Workflow: (await import('../src/models/Workflow')).Workflow,
    Request: (await import('../src/models/Request')).Request,
  };
  requestService = await import('../src/services/request.service');

  await (await import('../src/config/db')).connectDB();
  const admin = await m.User.create({
    name: 'admin',
    email: 'admin@test.dev',
    passwordHash: await bcrypt.hash('password123', 10),
    role: 'ADMIN',
  });
  ids.admin = admin.id;
  tokens.admin = (await login('admin@test.dev', 'password123')).token;

  await registerAs('alice', 'USER');
  await registerAs('mallory', 'USER');
  await registerAs('rev1', 'REVIEWER');
  await registerAs('rev2', 'REVIEWER');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('auth & roles', () => {
  test('self-registration ignores a requested role and always creates USER', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ name: 'eve', email: 'eve@test.dev', password: 'password123', role: 'ADMIN' })
      .expect(200);
    assert.equal(res.body.role, 'USER');
  });

  test('validation errors are a flat { field: message } map', async () => {
    const res = await api.post('/api/auth/register').send({ name: ' ', email: 'nope', password: 'abc' }).expect(400);
    assert.equal(res.body.name, 'Name is required');
    assert.equal(res.body.email, 'Email must be valid');
    assert.equal(res.body.password, 'Password must be at least 8 characters');

    const wf = await api
      .post('/api/workflows')
      .set(auth('admin'))
      .send({ name: 'x', steps: [{ stepIndex: 0, stepName: '', requiredRole: 'REVIEWER' }] })
      .expect(400);
    assert.equal(wf.body['steps[0].stepName'], 'Step name is required');
  });

  test('missing or invalid token is 401; wrong role is 403', async () => {
    await api.get('/api/requests/mine').expect(401);
    await api.get('/api/requests/mine').set({ Authorization: 'Bearer nope' }).expect(401);
    await api.get('/api/admin/users').set(auth('alice')).expect(403);
    await api.patch(`/api/admin/users/${ids.alice}/role`).set(auth('alice')).send({ role: 'ADMIN' }).expect(403);
  });

  test('admin user listing never exposes password hashes', async () => {
    const res = await api.get('/api/admin/users').set(auth('admin')).expect(200);
    assert.ok(res.body.length >= 5);
    for (const u of res.body) assert.equal(u.passwordHash, undefined);
  });

  test('CORS preflight allows PATCH (used by the role-change endpoint)', async () => {
    const res = await api
      .options(`/api/admin/users/${ids.alice}/role`)
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'PATCH')
      .expect(204);
    assert.match(res.headers['access-control-allow-methods'] ?? '', /PATCH/);
  });

  test('admin cannot change their own role', async () => {
    await api.patch(`/api/admin/users/${ids.admin}/role`).set(auth('admin')).send({ role: 'USER' }).expect(400);
  });

  test('unknown routes and malformed ids are 404', async () => {
    await api.get('/api/nope').set(auth('alice')).expect(404);
    await api.get('/api/requests/not-an-object-id').set(auth('alice')).expect(404);
  });
});

describe('workflows', () => {
  test('step order comes from the array, not client-supplied stepIndex', async () => {
    const res = await api
      .post('/api/workflows')
      .set(auth('admin'))
      .send({
        name: 'ordering',
        steps: [
          { stepIndex: 5, stepName: 'first', requiredRole: 'REVIEWER' },
          { stepIndex: 5, stepName: 'second', requiredRole: 'ADMIN' },
        ],
      })
      .expect(200);
    assert.deepEqual(
      res.body.steps.map((s: { stepIndex: number }) => s.stepIndex),
      [0, 1],
    );
  });

  test('non-owner non-admin cannot delete; active requests block deletion', async () => {
    const wf = await createWorkflow('alice', [{ requiredRole: 'REVIEWER' }]);
    await api.delete(`/api/workflows/${wf.id}`).set(auth('mallory')).expect(403);

    const req = await createRequest('mallory', wf.id);
    await api.delete(`/api/workflows/${wf.id}`).set(auth('alice')).expect(409);

    await api.post(`/api/requests/${req.id}/reject`).set(auth('rev1')).send({ comment: 'no' }).expect(200);
    await api.delete(`/api/workflows/${wf.id}`).set(auth('alice')).expect(204);
  });
});

describe('request access & approvals', () => {
  test('requests are only visible to creator, eligible approvers and admins', async () => {
    const wf = await createWorkflow('admin', [{ requiredRole: 'REVIEWER' }]);
    const req = await createRequest('alice', wf.id);

    await api.get(`/api/requests/${req.id}`).set(auth('mallory')).expect(404);
    await api.get(`/api/requests/${req.id}/verify`).set(auth('mallory')).expect(404);
    await api.get(`/api/requests/${req.id}`).set(auth('alice')).expect(200);
    await api.get(`/api/requests/${req.id}`).set(auth('rev1')).expect(200);
    await api.get(`/api/requests/${req.id}`).set(auth('admin')).expect(200);
  });

  test('a user cannot approve their own request', async () => {
    const wf = await createWorkflow('admin', [{ requiredRole: 'REVIEWER' }]);
    const req = await createRequest('rev1', wf.id);
    const res = await api.post(`/api/requests/${req.id}/approve`).set(auth('rev1')).send({}).expect(400);
    assert.match(res.body.message, /own request/);

    const pending = await api.get('/api/requests/pending').set(auth('rev1')).expect(200);
    assert.ok(!pending.body.some((r: { id: string }) => r.id === req.id));
  });

  test('approve works with no request body at all', async () => {
    const wf = await createWorkflow('admin', [{ requiredRole: 'REVIEWER' }]);
    const req = await createRequest('alice', wf.id);
    const res = await api.post(`/api/requests/${req.id}/approve`).set(auth('rev1')).expect(200);
    assert.equal(res.body.status, 'APPROVED');
  });

  test('requiredApprovals quorum is enforced, one vote per approver', async () => {
    const wf = await createWorkflow('admin', [{ requiredRole: 'REVIEWER', requiredApprovals: 2 }, { requiredRole: 'ADMIN' }]);
    const req = await createRequest('alice', wf.id);
    assert.ok(req.stepStartTimes['0']);

    let res = await api.post(`/api/requests/${req.id}/approve`).set(auth('rev1')).send({}).expect(200);
    assert.equal(res.body.currentStep, 0);
    assert.equal(res.body.status, 'IN_REVIEW');
    assert.deepEqual(res.body.stepApprovals['0'], [ids.rev1]);

    await api.post(`/api/requests/${req.id}/approve`).set(auth('rev1')).send({}).expect(400);
    const pending = await api.get('/api/requests/pending').set(auth('rev1')).expect(200);
    assert.ok(!pending.body.some((r: { id: string }) => r.id === req.id), 'already-approved reviewer should not see it as pending');

    res = await api.post(`/api/requests/${req.id}/approve`).set(auth('rev2')).send({}).expect(200);
    assert.equal(res.body.currentStep, 1);
    assert.ok(res.body.stepStartTimes['1']);

    res = await api.post(`/api/requests/${req.id}/approve`).set(auth('admin')).send({ comment: 'ship it' }).expect(200);
    assert.equal(res.body.status, 'APPROVED');
    assert.equal(res.body.history.length, 3);
  });

  test('concurrent approvals of the same step cannot both succeed', async () => {
    const wf = await createWorkflow('admin', [{ requiredRole: 'REVIEWER' }, { requiredRole: 'ADMIN' }]);
    const req = await createRequest('alice', wf.id);

    // Call the service directly so both approvals load the same request state
    // before either saves; over HTTP the auth middleware staggers them enough
    // that they usually run one after the other and the race never happens.
    const [rev1, rev2] = await Promise.all([loadUser('rev1'), loadUser('rev2')]);
    const results = await Promise.allSettled([
      requestService.approveRequest(rev1, req.id, 'first'),
      requestService.approveRequest(rev2, req.id, 'second'),
    ]);

    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;
    assert.ok(failure instanceof mongoose.Error.VersionError, `expected VersionError, got ${failure}`);

    const stored = await m.Request.findById(req.id);
    assert.equal(stored?.history.length, 1);
    assert.equal(stored?.currentStep, 1);
  });

  test('a concurrent approve and reject cannot both be recorded', async () => {
    const wf = await createWorkflow('admin', [{ requiredRole: 'REVIEWER' }, { requiredRole: 'ADMIN' }]);
    const req = await createRequest('alice', wf.id);

    const [rev1, rev2] = await Promise.all([loadUser('rev1'), loadUser('rev2')]);
    const results = await Promise.allSettled([
      requestService.approveRequest(rev2, req.id, 'approve'),
      requestService.rejectRequest(rev1, req.id, 'reject'),
    ]);

    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const stored = await m.Request.findById(req.id);
    assert.equal(stored?.history.length, 1);
  });
});

describe('SLA escalation', () => {
  test('escalates only the breached request and never mutates the workflow', async () => {
    const wf = await createWorkflow('admin', [{ requiredRole: 'REVIEWER', slaHours: 1 }]);
    const late = await createRequest('alice', wf.id);
    const fresh = await createRequest('alice', wf.id);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await m.Request.updateOne({ _id: late.id }, { $set: { 'stepStartTimes.0': twoHoursAgo } });

    const res = await api.post('/api/admin/trigger-sla-check').set(auth('admin')).expect(200);
    assert.equal(res.body.escalatedCount, 1);

    const storedWf = await m.Workflow.findById(wf.id);
    assert.equal(storedWf?.steps[0]?.requiredRole, 'REVIEWER');

    const lateNow = await m.Request.findById(late.id);
    assert.equal(lateNow?.escalated, true);
    assert.equal(lateNow?.originalRequiredRole, 'REVIEWER');

    const ids1 = (await api.get('/api/requests/pending').set(auth('rev1'))).body.map((r: { id: string }) => r.id);
    assert.ok(ids1.includes(fresh.id));
    assert.ok(!ids1.includes(late.id));

    const adminIds = (await api.get('/api/requests/pending').set(auth('admin'))).body.map((r: { id: string }) => r.id);
    assert.ok(adminIds.includes(late.id));

    await api.post(`/api/requests/${late.id}/approve`).set(auth('rev1')).send({}).expect(400);
    const approved = await api.post(`/api/requests/${late.id}/approve`).set(auth('admin')).send({}).expect(200);
    assert.equal(approved.body.status, 'APPROVED');
  });

  test('cron hook requires the shared secret', async () => {
    process.env.CRON_SECRET = 'cron-secret-value';
    await api.get('/api/cron/sla-escalation').expect(403);
    await api.get('/api/cron/sla-escalation').set({ Authorization: 'Bearer wrong-secret-value' }).expect(403);
    await api.get('/api/cron/sla-escalation').set({ Authorization: 'Bearer cron-secret-value' }).expect(200);
  });
});

describe('audit hash chain', () => {
  test('verifies an intact chain and detects tampering', async () => {
    const wf = await createWorkflow('admin', [{ requiredRole: 'REVIEWER' }, { requiredRole: 'ADMIN' }]);
    const req = await createRequest('alice', wf.id);
    await api.post(`/api/requests/${req.id}/approve`).set(auth('rev1')).send({ comment: 'looks good' }).expect(200);
    await api.post(`/api/requests/${req.id}/approve`).set(auth('admin')).send({ comment: 'approved' }).expect(200);

    let res = await api.get(`/api/requests/${req.id}/verify`).set(auth('alice')).expect(200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.length, 2);
    assert.match(res.body.headHash, /^[0-9a-f]{64}$/);

    await m.Request.updateOne({ _id: req.id }, { $set: { 'history.0.comment': 'edited after the fact' } });
    res = await api.get(`/api/requests/${req.id}/verify`).set(auth('alice')).expect(200);
    assert.equal(res.body.valid, false);
    assert.equal(res.body.brokenAtIndex, 0);
  });
});
