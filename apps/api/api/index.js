// Vercel serverless entry point. Unlike src/index.js (Render/Docker/local),
// this does NOT call app.listen() or start the setInterval SLA scheduler —
// serverless functions don't stay alive between requests, so a long-lived
// timer there would do nothing useful. Trigger SLA checks via
// POST /api/admin/trigger-sla-check on a Vercel Cron Job instead (see
// vercel.json's `crons` entry).
require('dotenv').config();

module.exports = require('../src/app');
