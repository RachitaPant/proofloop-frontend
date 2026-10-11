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
- **Sessions:** the web app authenticates with httpOnly cookies (15-minute
  access JWT + rotating refresh token, stored as a SHA-256 hash in
  `refresh_tokens`); API clients use `Authorization: Bearer`. Endpoints:
  `POST /api/auth/login|register` (start a session, also return a bearer
  token), `POST /api/auth/refresh` (rotate), `POST /api/auth/logout`
  (revoke the token family), `GET /api/auth/me`. Reusing a rotated refresh
  token more than 10s later revokes the whole family.
- **CSRF:** cookie-authenticated writes, refresh and logout require an
  allowed `Origin` (or `Sec-Fetch-Site: same-origin`). Bearer requests skip
  this, since browsers never attach them automatically.
- **401** = missing/invalid/expired credentials (the web app refreshes, then
  re-logs in); **403** = authenticated but not allowed.
- **Requests** are visible only to their creator, admins, anyone who already
  acted on them, and anyone eligible to act on the current step. Others get 404.
- **No self-approval**: a request's creator can't act on it.
- **Workflows** can be deleted only by their creator or an admin, and not while
  they have active (PENDING/IN_REVIEW) requests (409).

## Approval engine

The routing rules are pure functions in `packages/shared/src/engine.ts`
(also used by the web app for previews); `request.service.ts` applies them.

- **Stages:** each step has a `stage` (renumbered 0..n-1 on save). Steps in a
  stage run in parallel; `request.currentStep` is the current stage. Workflows
  saved before stages existed run one step per stage.
- **Conditions:** `step.condition` = `{ mode: all|any, rules: [{ field,
  operator, value }] }` over the workflow's `fields`. Operators: eq, neq, gt,
  gte, lt, lte, in, contains. A rule on a missing value is false. Field values
  are validated against the workflow on create; `skippedSteps` is computed
  then and stored. Creating a request that matches no step is refused.
- **Approval counts:** `requiredApprovals` is enforced per step;
  `stepApprovals` holds the **principals** (the delegator when a delegate
  acted). A stage completes when none of its applicable steps is still short of
  approvals. A single rejection, in any branch, rejects the request.
- **One action per person per stage**, counting actions taken for you by a
  delegate, so parallel reviews stay independent.
- **Which step:** approve/reject take an optional `stepIndex`, required only
  when the viewer can act on several parallel steps. `GET /requests/:id` and
  `/requests/pending` include `actionableSteps` for the viewer.
- **Approver groups** (`/api/groups`): a step has exactly one assignee,
  `requiredRole` or `approverGroupId` (the group's name is stored on the step for
  display and kept current on rename). Membership is checked at action time.
  Anyone signed in can list groups; only admins create, update or delete them;
  a group still used by a workflow can't be deleted (409). Escalated group steps
  go to ADMIN like role steps, and a delegate can act for a group member.
- **Delegation** (`/api/delegations`): time-boxed (max 90 days), one active per
  delegator, revocable by the delegator or an admin. It grants the delegator's
  role on approval steps only, and only while the delegator still holds it.
  Nobody approves their own request through a delegate, and no delegate acts
  for the request's creator. Audit entries record `onBehalfOf`, and it's part
  of the hash input (appended only when present, so older entries still verify).
- `stepStartTimes` records when each step became active; SLA deadlines are
  measured from it.
- SLA escalation adds breached steps to `escalatedSteps` on **the request**
  (and sets `escalated`/`originalRequiredRole`), routing those steps to ADMIN.
  The shared workflow template is never modified. Escalation clears when the
  request moves to the next stage.
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
- `GET|POST /api/delegations`, `DELETE /api/delegations/:id`: approval delegation
- `GET|POST /api/groups`, `PUT|DELETE /api/groups/:id`: approver groups
- `GET /api/auth/me`, `POST /api/auth/refresh`, `POST /api/auth/logout`: cookie sessions

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
- `AUTH_RATE_LIMIT` (default 20 login/register attempts per IP per 15 minutes) is counted
  per function instance, so treat it as a speed bump rather than a hard limit.
- `public/` is intentionally empty: Vercel expects a static output directory
  when a project has a build command.
