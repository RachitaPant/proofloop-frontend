// Vercel serverless entry point. `pnpm build` (tsup) compiles src/ to dist/
// first; this file just hands the Express app to Vercel's Node runtime.
// Unlike src/server.ts it never calls app.listen() or starts the in-process
// SLA scheduler. Vercel Cron hits /api/cron/sla-escalation instead (vercel.json).
require('dotenv').config();

module.exports = require('../dist/app.js').default;
