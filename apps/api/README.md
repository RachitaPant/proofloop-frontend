# ProofLoop API

Express 5 + TypeScript + MongoDB (Mongoose). Request bodies are validated with
the Zod schemas in `packages/shared`, which also define the response types the
web app uses. Deploys to Vercel's free Hobby plan as a serverless function, or
to any Node host.

It began as a mirror of the Spring Boot backend (archived in its own
repository) and keeps the same routes and JSON shapes, but is now ahead of it;
see "Divergence from Spring Boot".

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

## Development

Run from the repo root, or with `--filter @proofloop/api`:

```bash
cp apps/api/.env.example apps/api/.env      # MONGODB_URI, 32+ char JWT_SECRET
pnpm --filter @proofloop/api dev             # tsx watch, seeds demo data in development
pnpm --filter @proofloop/api test            # Vitest + supertest against an in-memory MongoDB
pnpm --filter @proofloop/api build           # tsup → dist/app.js (Vercel) + dist/server.js (Node)
```

The first test run downloads a MongoDB binary for `mongodb-memory-server`.

## Entry points

- `src/server.ts` → `dist/server.js`: long-running process (local, Docker,
  Render). Connects, seeds demo data outside production, starts the hourly
  in-process SLA scheduler, and listens on `PORT`.
- `api/index.js`: Vercel serverless function. Re-exports the bundled Express
  app from `dist/app.js`. No `listen()` and no scheduler; the DB connection
  is cached across warm invocations.

## Deploying

See [DEPLOYMENT.md](../../DEPLOYMENT.md). On Vercel:

- The SLA check runs as a **daily** Vercel Cron Job
  (`GET /api/cron/sla-escalation`, authorised by `CRON_SECRET`), because the
  Hobby plan only allows daily crons. On Pro you can tighten the schedule in
  `vercel.json` (e.g. `"0 * * * *"`).
- The demo seeder doesn't run on Vercel (no startup phase). Run the API
  locally once against the same `MONGODB_URI`, or register through the UI.
- `AUTH_RATE_LIMIT` (default 20 attempts per IP per 15 minutes) is counted
  per function instance, so treat it as a speed bump rather than a hard limit.
- `public/` is intentionally empty: Vercel expects a static output directory
  when a project has a build command.
