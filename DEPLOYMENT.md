# Deploying ProofLoop

Both apps deploy to Vercel's free Hobby plan as two Vercel projects pointing
at this one repository. MongoDB runs on an Atlas free (M0) cluster.

## 1. MongoDB Atlas

1. Create a free M0 cluster and a database user.
2. Network Access: allow `0.0.0.0/0` (Vercel functions don't have fixed IPs).
3. Copy the connection string (`mongodb+srv://...`).

## 2. API project (`apps/api`)

New Vercel project → import this repo → **Root Directory: `apps/api`**,
Framework Preset: **Other**. Vercel detects the pnpm workspace and installs
from the repo root; `vercel.json` runs `pnpm build` (tsup) and routes every
path to the Express function in `api/index.js`.

Environment variables (Production and Preview):

| Variable               | Value                                                        |
| ---------------------- | ------------------------------------------------------------ |
| `MONGODB_URI`          | Atlas connection string                                      |
| `MONGODB_DATABASE`     | `proofloop`                                                  |
| `JWT_SECRET`           | Random string, **at least 32 characters**                    |
| `JWT_EXPIRATION_MS`    | `86400000` (24h)                                             |
| `CORS_ALLOWED_ORIGINS` | The web app's URL(s), comma-separated                        |
| `CRON_SECRET`          | Random string; authorises the daily SLA cron                 |
| `NODE_ENV`             | `production` (disables the demo-data seeder)                 |

The SLA escalation cron runs daily (the Hobby plan's limit), configured in
`apps/api/vercel.json`. Check `https://<api>/health` returns `{"status":"ok"}`.

## 3. Web project (`apps/web`)

New Vercel project → same repo → **Root Directory: `apps/web`**, Framework
Preset: **Next.js**. Set `NEXT_PUBLIC_API_URL` to the API project's URL.

## Moving existing Vercel projects to the monorepo

If you deployed the old `proofloop-back` / `proofloop-frontend` repos:

1. Project → Settings → Git → connect this repository instead.
2. Settings → Build and Deployment → Root Directory → `apps/api` or `apps/web`.
3. Leave "Include files outside the root directory in the Build Step" enabled
   (the default); both apps need `packages/shared`.
4. Redeploy, then confirm `/health` (API) and login (web).

## Other hosts

`apps/api/Dockerfile` builds a standalone API image from the repo root:

```bash
docker build -f apps/api/Dockerfile -t proofloop-api .
docker run -p 8080:8080 --env-file apps/api/.env proofloop-api
```

It runs `dist/server.js`, which also starts the hourly in-process SLA
scheduler (no cron needed).
