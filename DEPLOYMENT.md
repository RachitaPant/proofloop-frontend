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
| `JWT_EXPIRATION_MS`    | `86400000` (24h): bearer tokens for API clients              |
| `ACCESS_TOKEN_TTL_SECONDS` / `REFRESH_TOKEN_TTL_DAYS` | Optional; browser session cookies (default 900 / 30) |
| `CORS_ALLOWED_ORIGINS` | The web app's URL(s), comma-separated. `*` matches within one domain label, so add `https://proofloop-frontend-*-<team>.vercel.app` to let preview deployments write |
| `CRON_SECRET`          | Random string; authorises the daily SLA cron                 |
| `NODE_ENV`             | `production` (disables the sample-data seeder)               |
| `APP_URL`              | The web app's public URL, used for links in invite emails (falls back to the request's origin) |
| `MAIL_PROVIDER` + credentials | How invite emails are sent: `smtp` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) or `resend` (`RESEND_API_KEY`, `MAIL_FROM`). Optional: without it invites still work, shown as a link to share |

**Email without a domain:** Resend's `onboarding@resend.dev` sender can only
email your own address, so it can't deliver invites to teammates. Use Gmail SMTP
instead: turn on 2-Step Verification, create an [app password](https://myaccount.google.com/apppasswords), then set
`MAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`,
`SMTP_USER=<you>@gmail.com`, `SMTP_PASS=<app password>`. When you own a domain,
verify it in Resend and switch to `MAIL_PROVIDER=resend` (no code change).

Existing data from before organisations existed moves into a default
"ProofLoop Demo" organisation on the first request after deploy; its earliest
admin becomes the owner.

The SLA escalation cron runs daily (the Hobby plan's limit), configured in
`apps/api/vercel.json`. Check `https://<api>/health` returns `{"status":"ok"}`.

## 3. Web project (`apps/web`)

New Vercel project → same repo → **Root Directory: `apps/web`**, Framework
Preset: **Next.js**. Set `API_URL` to the API project's URL (the existing
`NEXT_PUBLIC_API_URL` also works). The browser never calls the API directly:
`/api/*` on the web app is proxied there, which keeps session cookies first-party.

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
