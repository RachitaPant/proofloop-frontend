# ProofLoop

Multi-step approval workflows with role-based routing, SLA escalation, and a
tamper-evident (SHA-256 hash-chained) audit trail.

## Repository layout

```
apps/
  api/         Express 5 + TypeScript + MongoDB REST API (Vercel serverless or any Node host)
  web/         Next.js frontend
packages/
  shared/      Zod schemas + TypeScript types shared by api and web
```

pnpm workspaces + Turborepo. The shared package is consumed as TypeScript
source: Next compiles it via `transpilePackages`, and the API bundles it with
tsup.

## Getting started

Requires Node 22+ and pnpm (`corepack enable`).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # set MONGODB_URI and a 32+ char JWT_SECRET
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > apps/web/.env
pnpm dev                                 # api on :8080, web on :3000
```

In development the API seeds demo users on an empty database:

| Role     | Email                  | Password    |
| -------- | ---------------------- | ----------- |
| Admin    | admin@proofloop.com    | admin123    |
| Reviewer | reviewer@proofloop.com | reviewer123 |
| User     | user@proofloop.com     | user123     |

## Scripts (run from the repo root)

| Command          | What it does                                                    |
| ---------------- | --------------------------------------------------------------- |
| `pnpm dev`       | Run api and web in watch mode                                   |
| `pnpm typecheck` | Type-check every package                                        |
| `pnpm test`      | API integration tests against an in-memory MongoDB (no Atlas)   |
| `pnpm build`     | Production builds (tsup for the API, `next build` for the web)  |

CI (`.github/workflows/ci.yml`) runs typecheck, test and build on every push
to `main` and on every pull request.

## How approvals work

- Each workflow is an ordered list of steps; each step names the role that may
  act on it, how many distinct approvals it needs, and an optional SLA.
- Sign-ups are always `USER`. Admins grant `REVIEWER`/`ADMIN` from the admin page.
- Requests are visible only to their creator, admins, past actors and current
  eligible approvers. Nobody can approve their own request.
- A step whose SLA passes is escalated to ADMIN on that request only.
- Every approve/reject is appended to a SHA-256 hash chain;
  `GET /api/requests/:id/verify` (and the **Verify chain** button) recomputes it.

See [apps/api/README.md](apps/api/README.md) for the full API behaviour and
[DEPLOYMENT.md](DEPLOYMENT.md) for deploying to Vercel.

## License

MIT
