// Workflow engine v2: conditional routing, parallel stages and delegation.
import assert from 'node:assert/strict';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { startHarness, step, type Harness } from './harness';

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
  await h.registerAs('alice', 'USER');
  await h.registerAs('bob', 'USER');
  await h.registerAs('rev1', 'REVIEWER');
  await h.registerAs('rev2', 'REVIEWER');
  await h.registerAs('rev3', 'REVIEWER');
});

afterAll(async () => {
  await h?.stop();
});

const approve = (key: string, id: string, body: Record<string, unknown> = {}) =>
  h.api.post(`/api/requests/${id}/approve`).set(h.auth(key)).send(body);

const pendingIds = async (key: string) =>
  (await h.api.get('/api/requests/pending').set(h.auth(key)).expect(200)).body.map((r: { id: string }) => r.id);

describe('conditional routing', () => {
  const purchase = () =>
    h.createWorkflow('admin', {
      fields: [
        { key: 'amount', label: 'Amount', type: 'number', required: true },
        { key: 'department', label: 'Department', type: 'select', options: ['Finance', 'Engineering'] },
      ],
      steps: [
        step('Manager', 'REVIEWER'),
        step('CFO', 'ADMIN', {
          stepIndex: 1,
          condition: { mode: 'all', rules: [{ field: 'amount', operator: 'gt', value: 100000 }] },
        }),
      ],
    });

  test('a step whose condition fails is skipped, and recorded as skipped', async () => {
    const wf = await purchase();
    const small = await h.createRequest('alice', wf.id, { amount: '5000' });
    assert.deepEqual(small.skippedSteps, [1]);
    assert.deepEqual(small.fields, { amount: 5000 });

    const done = await approve('rev1', small.id).expect(200);
    assert.equal(done.body.status, 'APPROVED');
  });

  test('a step whose condition matches is required', async () => {
    const wf = await purchase();
    const big = await h.createRequest('alice', wf.id, { amount: 250000, department: 'Finance' });
    assert.deepEqual(big.skippedSteps, []);

    const afterManager = await approve('rev1', big.id).expect(200);
    assert.equal(afterManager.body.status, 'IN_REVIEW');
    assert.equal(afterManager.body.currentStep, 1);
    assert.ok(afterManager.body.stepStartTimes['1']);

    const done = await approve('admin', big.id).expect(200);
    assert.equal(done.body.status, 'APPROVED');
  });

  test('request fields are validated against the workflow', async () => {
    const wf = await purchase();
    const missing = await h.api.post('/api/requests').set(h.auth('alice')).send({ title: 't', workflowId: wf.id }).expect(400);
    assert.equal(missing.body['fields.amount'], 'Amount is required');

    const badSelect = await h.api
      .post('/api/requests')
      .set(h.auth('alice'))
      .send({ title: 't', workflowId: wf.id, fields: { amount: 1, department: 'Sales' } })
      .expect(400);
    assert.match(badSelect.body['fields.department'], /one of/);
  });

  test('a request matching no step is refused', async () => {
    const wf = await h.createWorkflow('admin', {
      fields: [{ key: 'amount', label: 'Amount', type: 'number', required: true }],
      steps: [step('Only big', 'REVIEWER', { condition: { rules: [{ field: 'amount', operator: 'gte', value: 1000 }] } })],
    });
    const res = await h.api
      .post('/api/requests')
      .set(h.auth('alice'))
      .send({ title: 't', workflowId: wf.id, fields: { amount: 10 } })
      .expect(400);
    assert.match(res.body.message, /None of this workflow's approval steps apply/);
  });

  test('invalid conditions are rejected when the workflow is created', async () => {
    const res = await h.api
      .post('/api/workflows')
      .set(h.auth('admin'))
      .send({
        name: 'bad',
        fields: [{ key: 'note', label: 'Note', type: 'text' }],
        steps: [step('S', 'REVIEWER', { condition: { rules: [{ field: 'note', operator: 'gt', value: 5 }] } })],
      })
      .expect(400);
    assert.match(res.body['steps[0].condition.rules[0].operator'], /only works on number fields/);
  });
});

describe('parallel stages', () => {
  // (Legal ∥ Security) → Final
  const parallel = () =>
    h.createWorkflow('admin', {
      steps: [
        step('Legal', 'REVIEWER', { stage: 0 }),
        step('Security', 'REVIEWER', { stage: 0, slaHours: 1 }),
        step('Final', 'ADMIN', { stage: 1 }),
      ],
    });

  test('stages are normalised and both parallel steps start together', async () => {
    const wf = await parallel();
    assert.deepEqual(
      wf.steps.map((s: { stage: number }) => s.stage),
      [0, 0, 1],
    );
    const req = await h.createRequest('alice', wf.id);
    assert.ok(req.stepStartTimes['0'] && req.stepStartTimes['1']);
    assert.equal(req.stepStartTimes['2'], undefined);
  });

  test('the stage completes only when every parallel step is approved, by different people', async () => {
    const wf = await parallel();
    const req = await h.createRequest('alice', wf.id);

    const detail = await h.api.get(`/api/requests/${req.id}`).set(h.auth('rev1')).expect(200);
    assert.deepEqual(
      detail.body.actionableSteps.map((a: { stepIndex: number }) => a.stepIndex),
      [0, 1],
    );

    const ambiguous = await approve('rev1', req.id).expect(400);
    assert.match(ambiguous.body.message, /specify stepIndex/);

    const legal = await approve('rev1', req.id, { stepIndex: 0 }).expect(200);
    assert.equal(legal.body.currentStep, 0, 'still waiting on Security');

    // rev1 already signed off in this stage, so can't also take the other branch.
    const twice = await approve('rev1', req.id, { stepIndex: 1 }).expect(400);
    assert.match(twice.body.message, /already approved/);
    assert.ok(!(await pendingIds('rev1')).includes(req.id));

    const security = await approve('rev2', req.id).expect(200);
    assert.equal(security.body.currentStep, 1);
    assert.equal((await approve('admin', req.id).expect(200)).body.status, 'APPROVED');
  });

  test('a rejection in any branch rejects the request', async () => {
    const wf = await parallel();
    const req = await h.createRequest('alice', wf.id);
    await approve('rev1', req.id, { stepIndex: 0 }).expect(200);
    const rejected = await h.api.post(`/api/requests/${req.id}/reject`).set(h.auth('rev2')).send({ stepIndex: 1 }).expect(200);
    assert.equal(rejected.body.status, 'REJECTED');
  });

  test('SLA escalation applies per parallel step', async () => {
    const wf = await parallel();
    const req = await h.createRequest('alice', wf.id);
    const { Request } = await import('../src/models/Request');
    await Request.updateOne({ _id: req.id }, { $set: { 'stepStartTimes.1': new Date(Date.now() - 2 * 3600_000) } });

    await h.api.post('/api/admin/trigger-sla-check').set(h.auth('admin')).expect(200);
    const after = await h.api.get(`/api/requests/${req.id}`).set(h.auth('admin')).expect(200);
    assert.deepEqual(after.body.escalatedSteps, [1]);
    assert.deepEqual(
      after.body.actionableSteps.map((a: { stepIndex: number }) => a.stepIndex),
      [1],
      'admin can act on the escalated Security step only',
    );

    const reviewerView = await h.api.get(`/api/requests/${req.id}`).set(h.auth('rev1')).expect(200);
    assert.deepEqual(
      reviewerView.body.actionableSteps.map((a: { stepIndex: number }) => a.stepIndex),
      [0],
      'Legal stays with reviewers',
    );
  });
});

describe('delegation', () => {
  const singleReview = () => h.createWorkflow('admin', { steps: [step('Review', 'REVIEWER', { requiredApprovals: 2 })] });
  const inAWeek = () => new Date(Date.now() + 7 * 24 * 3600_000).toISOString();

  test('validation: no self-delegation, no unknown users, at most 90 days, one active at a time', async () => {
    await h.api.post('/api/delegations').set(h.auth('rev3')).send({ toEmail: 'rev3@test.dev', endsAt: inAWeek() }).expect(400);
    await h.api.post('/api/delegations').set(h.auth('rev3')).send({ toEmail: 'nobody@test.dev', endsAt: inAWeek() }).expect(404);
    const tooLong = new Date(Date.now() + 100 * 24 * 3600_000).toISOString();
    await h.api.post('/api/delegations').set(h.auth('rev3')).send({ toEmail: 'bob@test.dev', endsAt: tooLong }).expect(400);
    await h.api.post('/api/delegations').set(h.auth('rev3')).send({ toEmail: 'bob@test.dev', endsAt: 'tomorrow' }).expect(400);
  });

  test('a delegate approves on the delegator’s behalf, recorded in the hash-chained audit trail', async () => {
    const wf = await singleReview();
    const req = await h.createRequest('bob', wf.id);

    const created = await h.api
      .post('/api/delegations')
      .set(h.auth('rev1'))
      .send({ toEmail: 'alice@test.dev', endsAt: inAWeek(), note: 'On leave' })
      .expect(201);
    assert.equal(created.body.role, 'REVIEWER');
    assert.equal(created.body.active, true);
    await h.api.post('/api/delegations').set(h.auth('rev1')).send({ toEmail: 'bob@test.dev', endsAt: inAWeek() }).expect(409);

    // alice is a USER, but can now act as rev1 on reviewer steps.
    assert.ok((await pendingIds('alice')).includes(req.id));
    const view = await h.api.get(`/api/requests/${req.id}`).set(h.auth('alice')).expect(200);
    assert.deepEqual(view.body.actionableSteps, [{ stepIndex: 0, onBehalfOf: { id: h.ids.rev1, name: 'rev1' } }]);

    const res = await approve('alice', req.id, { comment: 'for rev1' }).expect(200);
    const entry = res.body.history[0];
    assert.equal(entry.actedBy, h.ids.alice);
    assert.equal(entry.onBehalfOf, h.ids.rev1);
    assert.equal(entry.onBehalfOfName, 'rev1');
    assert.deepEqual(res.body.stepApprovals['0'], [h.ids.rev1], 'counts as rev1’s approval');

    // rev1's vote is used up, so rev1 can't add a second one on this step.
    await approve('rev1', req.id).expect(400);
    const done = await approve('rev2', req.id).expect(200);
    assert.equal(done.body.status, 'APPROVED');

    const chain = await h.api.get(`/api/requests/${req.id}/verify`).set(h.auth('bob')).expect(200);
    assert.equal(chain.body.valid, true);

    // The delegator can see what was done in their name.
    await h.api.get(`/api/requests/${req.id}`).set(h.auth('rev1')).expect(200);

    await h.api.delete(`/api/delegations/${created.body.id}`).set(h.auth('rev1')).expect(200);
  });

  test('no self-approval through delegation, either way round', async () => {
    const wf = await singleReview();
    const d = await h.api.post('/api/delegations').set(h.auth('rev2')).send({ toEmail: 'alice@test.dev', endsAt: inAWeek() }).expect(201);

    const alicesOwn = await h.createRequest('alice', wf.id);
    assert.match((await approve('alice', alicesOwn.id).expect(400)).body.message, /own request/);

    const rev2sOwn = await h.createRequest('rev2', wf.id);
    await approve('alice', rev2sOwn.id).expect(400);

    await h.api.delete(`/api/delegations/${d.body.id}`).set(h.auth('rev2')).expect(200);
  });

  test('revoking, demoting the delegator, or another user revoking all end the delegate’s access', async () => {
    const wf = await singleReview();
    const req = await h.createRequest('bob', wf.id);
    const d = await h.api.post('/api/delegations').set(h.auth('rev3')).send({ toEmail: 'alice@test.dev', endsAt: inAWeek() }).expect(201);
    assert.ok((await pendingIds('alice')).includes(req.id));

    await h.api.delete(`/api/delegations/${d.body.id}`).set(h.auth('bob')).expect(403);

    // Demoting the delegator withdraws the delegation without revoking it.
    await h.api.patch(`/api/admin/users/${h.ids.rev3}/role`).set(h.auth('admin')).send({ role: 'USER' }).expect(200);
    assert.ok(!(await pendingIds('alice')).includes(req.id));
    await h.api.patch(`/api/admin/users/${h.ids.rev3}/role`).set(h.auth('admin')).send({ role: 'REVIEWER' }).expect(200);
    assert.ok((await pendingIds('alice')).includes(req.id));

    const revoked = await h.api.delete(`/api/delegations/${d.body.id}`).set(h.auth('rev3')).expect(200);
    assert.equal(revoked.body.active, false);
    assert.ok(!(await pendingIds('alice')).includes(req.id));

    const mine = await h.api.get('/api/delegations').set(h.auth('alice')).expect(200);
    assert.ok(mine.body.received.some((x: { id: string }) => x.id === d.body.id));
  });

  test('delegation never grants admin API access', async () => {
    const d = await h.api.post('/api/delegations').set(h.auth('admin')).send({ toEmail: 'bob@test.dev', endsAt: inAWeek() }).expect(201);
    await h.api.get('/api/admin/users').set(h.auth('bob')).expect(403);
    await h.api.delete(`/api/delegations/${d.body.id}`).set(h.auth('admin')).expect(200);
  });
});
