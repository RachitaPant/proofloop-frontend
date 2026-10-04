# ProofLoop Backend (Express)

The primary ProofLoop API (Node/Express + MongoDB), deployable on Vercel's
free Hobby plan as a serverless function, or on any Node host. It began as a
mirror of the Spring Boot backend (`../backend`) and keeps the same routes and
JSON shapes, but is now **ahead** of it — see "Divergence from Spring Boot".

## Access rules

- **Registration** always creates a `USER`; any `role` in the body is ignored.
  Admins grant `REVIEWER`/`ADMIN` via `PATCH /api/admin/users/:id/role`.
- **401** = missing/invalid/expired token (client should re-login);
  **403** = authenticated but not allowed.
- **Requests** are visible only to their creator, admins, anyone who already
  acted on them, and anyone eligible to act on the current step. Others get 404.
- **No self-approval**: a request's creator can't act on it.
- **Workflows** can be deleted only by their creator or an admin, and not while
  they have active (PENDING/IN_REVIEW) requests (409).

## Approval engine

- `requiredApprovals` (quorum) is enforced per step: each eligible approver
  votes once (`stepApprovals`), and the step advances when the quorum is met.
  A single rejection rejects the request.
- `stepStartTimes` records when each step began; SLA deadlines are measured
  from it.
- SLA escalation sets `escalated`/`originalRequiredRole` on **the request** and
  routes its current step to ADMIN. The shared workflow template is never
  modified. Escalation clears when the request advances to the next step.
- Concurrent approvals are guarded by optimistic concurrency
  (`optimisticConcurrency` on the Request schema): the losing write gets **409**.
- Every action is appended to a SHA-256 hash chain
  (`previousHash` → `currentHash`). `GET /api/requests/:id/verify` recomputes
  the chain and reports the first broken entry. This detects edits to history,
  but someone with direct database write access could rewrite the whole chain.
  Anchoring the head hash outside the database is a planned follow-up.

## Endpoints added beyond the Spring Boot API

- `GET /api/requests/:id/verify`: audit-chain verification
- `GET /api/admin/users`: list users (password hashes are never serialized)
- `PATCH /api/admin/users/:id/role`: change a user's role (not your own)

## Divergence from Spring Boot

The Spring Boot service has none of the above: it never populates
`stepApprovals`/`stepStartTimes` or the hash chain, lets clients choose their
role at registration, and its SLA job mutates the workflow template. Don't
point the frontend at it for anything beyond local experiments.

## Tests

```bash
npm test   # integration tests against an in-memory MongoDB (no Atlas needed)
```

The first run downloads a MongoDB binary for `mongodb-memory-server`.

## Running locally

```bash
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET
npm install
npm run dev             # nodemon
# or: npm start
```

## Deploying on Render

- Runtime: Node (not Docker required, but a `Dockerfile` is included if you
  prefer a container build).
- Build command: `npm install`
- Start command: `npm start`
- Env vars: `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`,
  `JWT_EXPIRATION_MS`, `CORS_ALLOWED_ORIGINS`, `NODE_ENV=production`.

Then point the frontend's `NEXT_PUBLIC_API_URL` at this service's Render URL.

## Deploying on Vercel

The repo also works as a Vercel serverless deployment via `api/index.js` +
`vercel.json` (it rewrites every path to that one function, so the Express
app's own routing still applies).

**You must set these in Project Settings → Environment Variables** (for
Production and Preview) before it'll boot — a missing `MONGODB_URI` is the
`MongooseError: The 'uri' parameter to 'openUri()' must be a string, got
"undefined"` / 500 you'll see in the logs if it's absent:

- `MONGODB_URI`, `MONGODB_DATABASE`
- `JWT_SECRET`, `JWT_EXPIRATION_MS`
- `CORS_ALLOWED_ORIGINS` — your frontend's deployed origin(s)
- `NODE_ENV=production` (disables the demo seeder)
- `CRON_SECRET` — any random string; enables the SLA-escalation cron hook
- `JWT_SECRET` must be **at least 32 characters** or the API refuses to issue tokens
- `AUTH_RATE_LIMIT` (optional, default 20): login/register attempts per IP per 15 min. On Vercel this counter is per function instance, so treat it as a speed bump rather than a hard limit.

Serverless-specific differences from the Render/local entry point
(`src/index.js`):

- No `app.listen()` — Vercel invokes the exported Express app per-request.
- The DB connection is cached across warm invocations (`src/config/db.js`),
  not re-established every request.
- The in-process `setInterval` SLA scheduler does nothing useful here
  (functions don't stay alive between requests), so it's not started. Instead,
  `vercel.json` registers a daily Vercel Cron Job against
  `GET /api/cron/sla-escalation`, gated by the `CRON_SECRET` you set above.
  Daily, not hourly, because Vercel's Hobby plan caps cron jobs at once per
  day — the Render/local scheduler stays hourly (`src/services/slaEscalation.service.js`).
  If you're on a Pro/Enterprise plan and want finer-grained escalation on
  Vercel, tighten the schedule in `vercel.json` (e.g. `"0 * * * *"` for hourly).
- The demo-data seeder does **not** run automatically on Vercel (there's no
  startup phase to hook it into) — run it once locally against the same
  `MONGODB_URI`, or hit `/api/auth/register` directly, to create your first
  users.
