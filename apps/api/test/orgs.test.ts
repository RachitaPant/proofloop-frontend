// Organisations: sign-up, invites by email, roles inside an organisation, and
// (the part that matters most) that one organisation can never see or touch
// another's data. Run: pnpm test
import assert from 'node:assert/strict';
import { afterAll, afterEach, beforeAll, describe, test, vi } from 'vitest';
import { startHarness, step, type Harness } from './harness';
import { setLlmClientForTests } from '../src/config/llm';
import type { Mail } from '../src/services/mailer.service';

let h: Harness;
let mailer: typeof import('../src/services/mailer.service');
let outbox: Mail[] = [];
let aliceReq: { id: string };
let aliceWf: { id: string };
let groupId: string;

const linkToken = (link: string) => new URL(link).searchParams.get('token')!;

beforeAll(async () => {
  h = await startHarness();
  mailer = await import('../src/services/mailer.service');
  mailer.setMailTransportForTests(async (mail) => {
    outbox.push(mail);
  });

  // A model that fails loudly if anything outside the organisation reaches it.
  setLlmClientForTests({
    complete: async () => {
      throw new Error('the model must not be called for a foreign request');
    },
  });

  await h.registerAs('alice', 'USER');
  await h.registerAs('rev1', 'REVIEWER');
  await h.registerOwner('zed', 'Other Org');
  await h.registerAs('zoe', 'USER', 'zed');

  aliceWf = await h.createWorkflow('admin', { steps: [step('Review', 'REVIEWER')] });
  aliceReq = await h.createRequest('alice', aliceWf.id);
  groupId = (
    await h.api.post('/api/groups').set(h.auth('admin')).send({ name: 'Legal', memberIds: [h.ids.rev1] }).expect(201)
  ).body.id;
});

afterEach(() => {
  outbox = [];
});

afterAll(async () => {
  mailer.setMailTransportForTests(null);
  setLlmClientForTests(null);
  await h.stop();
});

const invite = (key: string, email: string, role = 'USER') =>
  h.api.post('/api/admin/invites').set(h.auth(key)).send({ email, role });

describe('creating an organisation', () => {
  test('the person who signs up becomes its owner and super admin', async () => {
    const me = await h.api.get('/api/auth/me').set(h.auth('admin')).expect(200);
    assert.equal(me.body.role, 'ADMIN');
    assert.equal(me.body.isOwner, true);

    const org = await h.api.get('/api/org').set(h.auth('admin')).expect(200);
    assert.equal(org.body.name, 'Test Org');
    assert.ok(org.body.memberCount >= 3);

    const member = await h.api.get('/api/auth/me').set(h.auth('alice')).expect(200);
    assert.notEqual(member.body.isOwner, true);
  });

  test('sign-up needs either an organisation name or an invite, never both', async () => {
    const base = { name: 'x', email: 'nobody@test.dev', password: 'password123' };
    const none = await h.api.post('/api/auth/register').send(base).expect(400);
    assert.equal(none.body.organizationName, 'Name your organisation');
    await h.api.post('/api/auth/register').send({ ...base, organizationName: 'A', inviteToken: 'x'.repeat(30) }).expect(400);
  });

  test('email addresses are case-insensitive for sign-up and sign-in', async () => {
    await h.api
      .post('/api/auth/register')
      .send({ name: 'Cased', email: 'Cased@Test.dev', password: 'password123', organizationName: 'Cased Org' })
      .expect(200);
    await h.api.post('/api/auth/login').send({ email: 'cased@test.dev', password: 'password123' }).expect(200);
    await h.api
      .post('/api/auth/register')
      .send({ name: 'Cased', email: 'CASED@test.dev', password: 'password123', organizationName: 'Again' })
      .expect(400);
  });

  test('only the owner renames the organisation', async () => {
    await h.api.patch('/api/org').set(h.auth('rev1')).send({ name: 'Nope' }).expect(403);
    const res = await h.api.patch('/api/org').set(h.auth('zed')).send({ name: 'Zed Industries' }).expect(200);
    assert.equal(res.body.name, 'Zed Industries');
    assert.equal((await h.api.get('/api/org').set(h.auth('admin')).expect(200)).body.name, 'Test Org');
  });
});

describe('invites', () => {
  test('creating an invite emails the link and returns it too', async () => {
    const res = await invite('admin', 'Newbie@Test.dev', 'REVIEWER').expect(201);
    assert.equal(res.body.emailStatus, 'sent');
    assert.equal(res.body.email, 'newbie@test.dev');
    assert.match(res.body.link, /\/join\?token=/);
    assert.equal(linkToken(res.body.link), res.body.token);
    assert.equal(res.body.tokenHash, undefined);

    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]!.to, 'newbie@test.dev');
    assert.match(outbox[0]!.subject, /Test Org/);
    assert.ok(outbox[0]!.text.includes(res.body.link));
    assert.ok(outbox[0]!.html.includes('Test Org'));
  });

  test('a failing mail provider does not lose the invite: the link still works', async () => {
    mailer.setMailTransportForTests(null);
    const original = process.env.MAIL_PROVIDER;
    process.env.MAIL_PROVIDER = 'none';
    try {
      const res = await invite('admin', 'nomail@test.dev').expect(201);
      assert.equal(res.body.emailStatus, 'not_configured');
      assert.ok(res.body.link);
      const joined = await h.api
        .post('/api/auth/register')
        .send({ name: 'No Mail', email: 'nomail@test.dev', password: 'password123', inviteToken: res.body.token })
        .expect(200);
      assert.equal(joined.body.role, 'USER');
    } finally {
      if (original === undefined) delete process.env.MAIL_PROVIDER;
      else process.env.MAIL_PROVIDER = original;
      mailer.setMailTransportForTests(async (mail) => {
        outbox.push(mail);
      });
    }
  });

  test('the join page can preview an invite, and bad links look the same as used ones', async () => {
    const res = await invite('admin', 'preview@test.dev', 'REVIEWER').expect(201);
    const ok = await h.api.get(`/api/auth/invite/${res.body.token}`).expect(200);
    assert.deepEqual(ok.body, { valid: true, orgName: 'Test Org', role: 'REVIEWER', email: 'preview@test.dev' });
    assert.deepEqual((await h.api.get('/api/auth/invite/not-a-real-token').expect(200)).body, { valid: false });
  });

  test('joining gives the invited role in that organisation, and the link works once', async () => {
    const res = await invite('admin', 'joiner@test.dev', 'REVIEWER').expect(201);
    const join = (email: string) =>
      h.api.post('/api/auth/register').send({ name: 'Joiner', email, password: 'password123', inviteToken: res.body.token });

    // Someone else's address can't use it, and a failed attempt doesn't burn it.
    const wrong = await join('someone-else@test.dev').expect(400);
    assert.match(wrong.body.message, /different email address/);

    const joined = await join('Joiner@test.dev').expect(200);
    assert.equal(joined.body.role, 'REVIEWER');
    const me = await h.api.get('/api/auth/me').set({ Authorization: `Bearer ${joined.body.token}` }).expect(200);
    assert.equal(me.body.orgId, (await h.api.get('/api/auth/me').set(h.auth('admin'))).body.orgId);
    assert.notEqual(me.body.isOwner, true);

    await join('joiner@test.dev').expect(400);
    assert.deepEqual((await h.api.get(`/api/auth/invite/${res.body.token}`)).body, { valid: false });
  });

  test('two people racing for one link create exactly one account', async () => {
    const res = await invite('admin', 'race@test.dev').expect(201);
    const attempt = () =>
      h.api
        .post('/api/auth/register')
        .send({ name: 'Race', email: 'race@test.dev', password: 'password123', inviteToken: res.body.token });
    const statuses = (await Promise.all([attempt(), attempt()])).map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 400]);
  });

  test('revoked, replaced and expired invites stop working', async () => {
    const revoked = await invite('admin', 'revoked@test.dev').expect(201);
    await h.api.delete(`/api/admin/invites/${revoked.body.id}`).set(h.auth('admin')).expect(204);
    assert.equal((await h.api.get(`/api/auth/invite/${revoked.body.token}`)).body.valid, false);

    // Inviting the same address again replaces the earlier link.
    const first = await invite('admin', 'twice@test.dev').expect(201);
    const second = await invite('admin', 'twice@test.dev').expect(201);
    assert.equal((await h.api.get(`/api/auth/invite/${first.body.token}`)).body.valid, false);
    assert.equal((await h.api.get(`/api/auth/invite/${second.body.token}`)).body.valid, true);

    const { Invite } = await import('../src/models/Invite');
    await Invite.updateOne({ _id: second.body.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await h.api.get(`/api/auth/invite/${second.body.token}`)).body.valid, false);
    await h.api
      .post('/api/auth/register')
      .send({ name: 'Late', email: 'twice@test.dev', password: 'password123', inviteToken: second.body.token })
      .expect(400);
  });

  test('re-sending rotates the link: the old one dies, the new one works', async () => {
    const created = await invite('admin', 'resend@test.dev').expect(201);
    outbox = [];
    const again = await h.api.post(`/api/admin/invites/${created.body.id}/resend`).set(h.auth('admin')).expect(200);
    assert.notEqual(again.body.token, created.body.token);
    assert.equal(outbox.length, 1);
    assert.equal((await h.api.get(`/api/auth/invite/${created.body.token}`)).body.valid, false);
    assert.equal((await h.api.get(`/api/auth/invite/${again.body.token}`)).body.valid, true);
  });

  test('pending invites are listed for the admin without their tokens', async () => {
    await invite('admin', 'listed@test.dev').expect(201);
    const list = await h.api.get('/api/admin/invites').set(h.auth('admin')).expect(200);
    const mine = list.body.find((i: { email: string }) => i.email === 'listed@test.dev');
    assert.ok(mine);
    assert.equal(mine.token, undefined);
    assert.equal(mine.tokenHash, undefined);
    assert.ok(!list.body.some((i: { email: string }) => i.email === 'joiner@test.dev'), 'used invites are not pending');
  });

  test('an address that already has an account cannot be invited', async () => {
    await invite('admin', 'alice@test.dev').expect(409);
    await invite('admin', 'zoe@test.dev').expect(409);
  });

  test('members cannot invite; admins cannot invite other admins; the owner can', async () => {
    await invite('alice', 'x1@test.dev').expect(403);
    await invite('rev1', 'x2@test.dev').expect(403);

    const admin2 = await invite('admin', 'admin2@test.dev', 'ADMIN').expect(201);
    await h.api
      .post('/api/auth/register')
      .send({ name: 'Admin Two', email: 'admin2@test.dev', password: 'password123', inviteToken: admin2.body.token })
      .expect(200)
      .then((r) => {
        assert.equal(r.body.role, 'ADMIN');
      });
    const login = await h.api.post('/api/auth/login').send({ email: 'admin2@test.dev', password: 'password123' }).expect(200);
    const asAdmin2 = { Authorization: `Bearer ${login.body.token}` };

    await h.api.post('/api/admin/invites').set(asAdmin2).send({ email: 'x3@test.dev', role: 'ADMIN' }).expect(403);
    await h.api.post('/api/admin/invites').set(asAdmin2).send({ email: 'x3@test.dev', role: 'USER' }).expect(201);
  });

  test('invite validation: the email is required', async () => {
    const res = await h.api.post('/api/admin/invites').set(h.auth('admin')).send({ role: 'USER' }).expect(400);
    assert.ok(res.body.email);
  });
});

describe('roles and members inside an organisation', () => {
  let admin2: { Authorization: string };
  let admin2Id: string;

  beforeAll(async () => {
    const res = await invite('admin', 'second-admin@test.dev', 'ADMIN').expect(201);
    const joined = await h.api
      .post('/api/auth/register')
      .send({ name: 'Second', email: 'second-admin@test.dev', password: 'password123', inviteToken: res.body.token })
      .expect(200);
    admin2 = { Authorization: `Bearer ${joined.body.token}` };
    admin2Id = joined.body.id;
  });

  test("nobody can change the owner's role, not even another admin", async () => {
    await h.api.patch(`/api/admin/users/${h.ids.admin}/role`).set(admin2).send({ role: 'USER' }).expect(403);
  });

  test('only the owner grants or takes away the admin role', async () => {
    await h.api.patch(`/api/admin/users/${h.ids.alice}/role`).set(admin2).send({ role: 'ADMIN' }).expect(403);
    await h.api.patch(`/api/admin/users/${admin2Id}/role`).set(h.auth('admin')).send({ role: 'REVIEWER' }).expect(200);
    await h.api.patch(`/api/admin/users/${admin2Id}/role`).set(h.auth('admin')).send({ role: 'ADMIN' }).expect(200);
    // Admins still manage the non-admin roles.
    await h.api.patch(`/api/admin/users/${h.ids.alice}/role`).set(admin2).send({ role: 'REVIEWER' }).expect(200);
    await h.api.patch(`/api/admin/users/${h.ids.alice}/role`).set(admin2).send({ role: 'USER' }).expect(200);
  });

  test('removing a member ends their access and tidies up after them', async () => {
    await h.registerAs('leaver', 'USER');
    const gid = (
      await h.api.post('/api/groups').set(h.auth('admin')).send({ name: 'Leavers', memberIds: [h.ids.leaver] }).expect(201)
    ).body.id;
    await h.api.get('/api/requests/mine').set(h.auth('leaver')).expect(200);

    await h.api.delete(`/api/admin/users/${h.ids.leaver}`).set(h.auth('admin')).expect(204);

    await h.api.get('/api/requests/mine').set(h.auth('leaver')).expect(401);
    await h.api.post('/api/auth/login').send({ email: 'leaver@test.dev', password: 'password123' }).expect(400);
    const groups = (await h.api.get('/api/groups').set(h.auth('admin')).expect(200)).body;
    assert.deepEqual(groups.find((g: { id: string }) => g.id === gid).memberIds, []);
    const users = (await h.api.get('/api/admin/users').set(h.auth('admin')).expect(200)).body;
    assert.ok(!users.some((u: { id: string }) => u.id === h.ids.leaver));
  });

  test('the owner and yourself cannot be removed; admins cannot remove admins', async () => {
    await h.api.delete(`/api/admin/users/${h.ids.admin}`).set(admin2).expect(403);
    await h.api.delete(`/api/admin/users/${admin2Id}`).set(admin2).expect(400);
    await h.registerAs('another-admin', 'ADMIN');
    await h.api.delete(`/api/admin/users/${h.ids['another-admin']}`).set(admin2).expect(403);
    await h.api.delete(`/api/admin/users/${h.ids['another-admin']}`).set(h.auth('admin')).expect(204);
  });

  test('members cannot remove anyone', async () => {
    await h.api.delete(`/api/admin/users/${h.ids.rev1}`).set(h.auth('alice')).expect(403);
  });
});

describe('isolation between organisations', () => {
  test("another organisation cannot see this one's workflows, requests or people", async () => {
    const wfs = (await h.api.get('/api/workflows').set(h.auth('zed')).expect(200)).body;
    assert.equal(wfs.length, 0);
    await h.api.get(`/api/workflows/${aliceWf.id}`).set(h.auth('zed')).expect(404);
    await h.api.delete(`/api/workflows/${aliceWf.id}`).set(h.auth('zed')).expect(404);

    // Even an owner/admin of another organisation gets a plain 404.
    await h.api.get(`/api/requests/${aliceReq.id}`).set(h.auth('zed')).expect(404);
    await h.api.get(`/api/requests/${aliceReq.id}/verify`).set(h.auth('zed')).expect(404);
    await h.api.post(`/api/requests/${aliceReq.id}/ai-review`).set(h.auth('zed')).expect(404);
    await h.api.post(`/api/requests/${aliceReq.id}/approve`).set(h.auth('zed')).send({}).expect(404);
    await h.api.post(`/api/requests/${aliceReq.id}/reject`).set(h.auth('zed')).send({}).expect(404);
    assert.equal((await h.api.get('/api/admin/requests').set(h.auth('zed')).expect(200)).body.length, 0);

    const users = (await h.api.get('/api/admin/users').set(h.auth('zed')).expect(200)).body;
    assert.deepEqual(users.map((u: { email: string }) => u.email).sort(), ['zed@test.dev', 'zoe@test.dev']);
  });

  test('a reviewer in another organisation has nothing to approve', async () => {
    await h.registerAs('zack', 'REVIEWER', 'zed');
    assert.equal((await h.api.get('/api/requests/pending').set(h.auth('zack')).expect(200)).body.length, 0);
    await h.api.post(`/api/requests/${aliceReq.id}/approve`).set(h.auth('zack')).send({}).expect(404);
  });

  test("cannot route a request through, or build on, another organisation's data", async () => {
    await h.api.post('/api/requests').set(h.auth('zoe')).send({ title: 'sneaky', workflowId: aliceWf.id }).expect(404);

    const wf = await h.api
      .post('/api/workflows')
      .set(h.auth('zed'))
      .send({ name: 'x', steps: [{ stepIndex: 0, stepName: 'Legal', approverGroupId: groupId }] })
      .expect(400);
    assert.ok(wf.body['steps[0].approverGroupId']);

    const group = await h.api
      .post('/api/groups')
      .set(h.auth('zed'))
      .send({ name: 'Borrowed', memberIds: [h.ids.rev1] })
      .expect(400);
    assert.ok(group.body.memberIds);
  });

  test("groups, delegations and role changes stop at the organisation's edge", async () => {
    assert.equal((await h.api.get('/api/groups').set(h.auth('zed')).expect(200)).body.length, 0);
    await h.api.put(`/api/groups/${groupId}`).set(h.auth('zed')).send({ name: 'Hijack', memberIds: [] }).expect(404);
    await h.api.delete(`/api/groups/${groupId}`).set(h.auth('zed')).expect(404);

    const ends = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await h.api
      .post('/api/delegations')
      .set(h.auth('zed'))
      .send({ toEmail: 'rev1@test.dev', endsAt: ends })
      .expect(404);

    await h.api.patch(`/api/admin/users/${h.ids.alice}/role`).set(h.auth('zed')).send({ role: 'ADMIN' }).expect(404);
    await h.api.delete(`/api/admin/users/${h.ids.alice}`).set(h.auth('zed')).expect(404);
    assert.equal((await h.api.get('/api/auth/me').set(h.auth('alice'))).body.role, 'USER');
  });

  test("another organisation's invites are invisible and cannot be managed", async () => {
    const created = await invite('admin', 'private-invite@test.dev').expect(201);
    const list = (await h.api.get('/api/admin/invites').set(h.auth('zed')).expect(200)).body;
    assert.ok(!list.some((i: { id: string }) => i.id === created.body.id));
    await h.api.delete(`/api/admin/invites/${created.body.id}`).set(h.auth('zed')).expect(404);
    await h.api.post(`/api/admin/invites/${created.body.id}/resend`).set(h.auth('zed')).expect(404);
  });

  test('analytics and the SLA check only count and touch your own organisation', async () => {
    const mine = (await h.api.get('/api/admin/analytics').set(h.auth('admin')).expect(200)).body;
    const theirs = (await h.api.get('/api/admin/analytics').set(h.auth('zed')).expect(200)).body;
    assert.ok(mine.totalRequests >= 1);
    assert.equal(theirs.totalRequests, 0);
    assert.equal(theirs.totalWorkflows, 0);
    assert.equal(theirs.totalUsers, 3);

    const sla = await h.api.post('/api/admin/trigger-sla-check').set(h.auth('zed')).expect(200);
    assert.equal(sla.body.escalatedCount, 0);
  });

  test('one organisation can reuse names another uses', async () => {
    await h.api.post('/api/groups').set(h.auth('zed')).send({ name: 'Legal', memberIds: [] }).expect(201);
    await h.api.post('/api/groups').set(h.auth('admin')).send({ name: 'Legal', memberIds: [] }).expect(409);
  });
});

describe('pre-organisation data', () => {
  test('is moved into one default organisation, with its first admin as owner', async () => {
    const { User } = await import('../src/models/User');
    const { Workflow } = await import('../src/models/Workflow');
    const { Organization } = await import('../src/models/Organization');
    const { migrateToOrganizations } = await import('../src/services/migration.service');

    // Documents as they were stored before organisations existed.
    const stamp = new Date('2026-01-01');
    await User.collection.insertMany([
      { name: 'Old Admin', email: 'old-admin@test.dev', passwordHash: 'x', role: 'ADMIN', createdAt: stamp },
      { name: 'Old User', email: 'old-user@test.dev', passwordHash: 'x', role: 'USER', createdAt: new Date('2026-01-02') },
    ]);
    await Workflow.collection.insertOne({
      name: 'Legacy flow',
      createdBy: 'old',
      steps: [],
      fields: [],
      createdAt: stamp,
    });

    await migrateToOrganizations();
    await migrateToOrganizations(); // idempotent

    const org = await Organization.findOne({ isDefault: true });
    assert.ok(org);
    assert.equal(await Organization.countDocuments({ isDefault: true }), 1);
    const oldAdmin = await User.findOne({ email: 'old-admin@test.dev' });
    const oldUser = await User.findOne({ email: 'old-user@test.dev' });
    assert.equal(oldAdmin!.orgId, org.id);
    assert.equal(oldUser!.orgId, org.id);
    assert.equal(oldAdmin!.isOwner, true);
    assert.notEqual(oldUser!.isOwner, true);
    assert.equal((await Workflow.findOne({ name: 'Legacy flow' }))!.orgId, org.id);

    // Existing organisations are untouched.
    const admin = await User.findById(h.ids.admin);
    assert.notEqual(admin!.orgId, org.id);
  });
});

describe('invite emails', () => {
  test('names are escaped in HTML and cannot inject headers into the subject', async () => {
    const { buildInviteEmail } = await import('../src/services/inviteEmail');
    const mail = buildInviteEmail({
      to: 'a@test.dev',
      orgName: 'Evil <script>alert(1)</script>\nBcc: victim@test.dev',
      inviterName: 'Mallory "the" <b>bold</b>',
      role: 'USER',
      link: 'https://app.example.com/join?token=abc&x="y"',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    });
    assert.ok(!/[\r\n]/.test(mail.subject));
    assert.ok(!mail.html.includes('<script>'));
    assert.ok(!mail.html.includes('<b>bold'));
    assert.ok(mail.html.includes('&lt;script&gt;'));
    assert.ok(mail.html.includes('token=abc&amp;x=&quot;y&quot;'));
    assert.ok(mail.text.includes('https://app.example.com/join?token=abc&x="y"'));
  });
});

describe('mail providers', () => {
  const keys = ['MAIL_PROVIDER', 'SMTP_HOST', 'RESEND_API_KEY', 'NODE_ENV', 'MAIL_FROM'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.unstubAllGlobals();
  });

  test('the provider is inferred from whichever credentials are set', () => {
    for (const k of keys) delete process.env[k];
    process.env.NODE_ENV = 'production';
    assert.equal(mailer.mailProvider(), 'none');
    process.env.NODE_ENV = 'development';
    assert.equal(mailer.mailProvider(), 'console');
    process.env.RESEND_API_KEY = 'k';
    assert.equal(mailer.mailProvider(), 'resend');
    process.env.SMTP_HOST = 'smtp.gmail.com';
    assert.equal(mailer.mailProvider(), 'smtp');
    process.env.MAIL_PROVIDER = 'resend';
    assert.equal(mailer.mailProvider(), 'resend');
  });

  test('Resend: posts the email to its API; provider errors become a "failed" status, not an exception', async () => {
    mailer.setMailTransportForTests(null);
    process.env.MAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 'secret-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(new Response('{"id":"1"}', { status: 200 }));
    const mail = { to: 'a@test.dev', subject: 'Hi', text: 't', html: '<p>t</p>' };
    assert.equal(await mailer.sendMail(mail), 'sent');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer secret-key');
    const body = JSON.parse(init.body as string);
    assert.deepEqual(body.to, ['a@test.dev']);
    assert.equal(body.from, 'ProofLoop <onboarding@resend.dev>');

    fetchMock.mockResolvedValueOnce(new Response('{"message":"You can only send to yourself"}', { status: 403 }));
    assert.equal(await mailer.sendMail(mail), 'failed');
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    assert.equal(await mailer.sendMail(mail), 'failed');
  });
});
