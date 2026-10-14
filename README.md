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
cp apps/web/.env.example apps/web/.env       # API_URL=http://localhost:8080
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

## Authentication

- **Web app:** the browser only talks to the web app's own origin; `/api/*` is
  proxied to the API (Next.js rewrites), so the session lives in first-party,
  `httpOnly`, `SameSite=Lax` cookies that page scripts can't read:
  a 15-minute access JWT and a rotating refresh token (30 days, stored hashed).
  The client refreshes silently on a 401. Replaying an already-rotated refresh
  token revokes that whole login's token family (theft detection).
- **CSRF:** cookie-authenticated writes must come from an allowed origin
  (`CORS_ALLOWED_ORIGINS`), on top of SameSite=Lax.
- **API clients** (Postman, scripts, agents) send `Authorization: Bearer <token>`
  using the `token` returned by `/api/auth/login`.

## AI features (optional)

Set `AI_API_KEY` on the API to enable them; without it the AI controls are
hidden and the endpoints return 503. They work with **any OpenAI-compatible
chat API**, and the default setup uses [Groq](https://console.groq.com)'s free
tier with `openai/gpt-oss-120b` (no vendor SDK: one `fetch`, so switching to
OpenRouter, Gemini's compatibility endpoint, or a local Ollama is three env
vars: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`).

- **AI workflow drafting:** describe a process in plain English in the workflow
  builder ("manager, then legal and security together, CFO above 100k") and the
  model drafts the fields, steps, conditions, parallel stages and approver
  groups. It returns schema-constrained JSON (strict `json_schema` where the
  provider supports it, plain JSON mode otherwise, detected automatically); the
  server maps it onto the real workflow schema and **re-validates**. Small free
  models slip now and then, so an unusable reply gets one repair attempt that
  tells the model what was wrong, and after that the draft is rejected, never
  passed on. The draft only fills in the form; a human reviews it (with the
  model's stated assumptions) and creates the workflow through the normal,
  permission-checked endpoint.
- **Safety and limits:** the user's description is fenced as data in the prompt
  and the model has no tools or write access, so injected instructions can only
  change a draft a human then reviews. Group members are never sent to the
  model. Usage is capped per user per hour and across all users per day
  (counters live in MongoDB, so the limits hold across serverless instances),
  which also keeps you inside a free tier's quota; failed calls are refunded;
  provider errors are logged, never returned.
- **Privacy:** workflow descriptions and approver-group names are sent to the
  provider. Free tiers of some providers (notably Google Gemini's) may use
  prompts to improve their products, so don't put confidential details in them.

## How approvals work

- A workflow defines **request fields** (number, text, choice) and **steps**.
  Each step names the role that may act on it, how many distinct approvals it
  needs, and an optional SLA.
- **Stages:** steps run in stages; steps in the same stage run **in parallel**
  and all must approve before the next stage starts. Nobody signs off on two
  branches of the same stage.
- **Conditional routing:** a step can apply only when the request's fields
  match (e.g. *CFO approval only when Amount > 100000*). Conditions are data
  evaluated with a fixed set of operators (never `eval`). The routing is
  decided when the request is created and stored with it. The request form
  previews the route live, using the same engine (`packages/shared`).
- **Approver groups:** a step can go to a named team (e.g. *Finance team*)
  instead of a role. Admins manage groups on the admin page; membership is read
  when someone acts, so changes apply to open requests immediately.
- **Delegation:** anyone can let a named colleague approve in their place for
  up to 90 days. It covers approval steps only (never admin access) and ends if
  the delegator loses the role. The audit trail records "on behalf of".
- Sign-ups are always `USER`. Admins grant `REVIEWER`/`ADMIN` from the admin page.
- Requests are visible only to their creator, admins, people involved and current
  eligible approvers. Nobody can approve their own request, directly or through a delegate.
- A step whose SLA passes is escalated to ADMIN on that request only.
- Every approve/reject is appended to a SHA-256 hash chain;
  `GET /api/requests/:id/verify` (and the **Verify chain** button) recomputes it.

See [apps/api/README.md](apps/api/README.md) for the full API behaviour and
[DEPLOYMENT.md](DEPLOYMENT.md) for deploying to Vercel.

## License

MIT
