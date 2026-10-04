const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const workflowRoutes = require('./routes/workflow.routes');
const requestRoutes = require('./routes/request.routes');
const adminRoutes = require('./routes/admin.routes');
const slaEscalationService = require('./services/slaEscalation.service');

const app = express();

// Vercel/Render sit behind a proxy; trust its X-Forwarded-For so rate
// limiting keys on the real client IP rather than the proxy's.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());

// Mirrors SecurityConfig's CorsConfigurationSource.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    credentials: true,
  }),
);

app.use(express.json({ limit: '100kb' }));

// Brute-force protection for login/register. The default in-memory store is
// per-instance — on Vercel each warm function instance has its own counter,
// so this is a speed bump rather than a hard global limit. Swap in a shared
// store (e.g. Upstash Redis) if you need a strict cross-instance limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 429, error: 'Too Many Requests', message: 'Too many attempts, please try again later.' },
});

// Every request needs a live DB connection; connectDB() is cached, so this
// is a no-op after the first (warm) invocation on serverless platforms.
app.use((req, res, next) => {
  connectDB().then(() => next(), next);
});

// /api/auth/** is public; everything else requires a valid JWT (enforced
// per-router below), and /api/admin/** additionally requires ADMIN.
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Unauthenticated-but-secret-gated hook for Vercel Cron (which can only send
// scheduled GET requests, not a user's JWT). Set CRON_SECRET and point a
// Vercel Cron Job at this path (daily on the Hobby plan) — see vercel.json.
// On Render/local, the in-process setInterval scheduler covers this instead.
app.get('/api/cron/sla-escalation', async (req, res, next) => {
  const expected = Buffer.from(process.env.CRON_SECRET || '');
  const provided = Buffer.from((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (expected.length === 0 || provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const escalatedCount = await slaEscalationService.checkAndEscalateRequests();
    res.json({ message: 'SLA escalation check triggered', escalatedCount });
  } catch (err) {
    next(err);
  }
});

app.use((_req, res) => {
  res.status(404).json({ timestamp: new Date().toISOString(), status: 404, error: 'Not Found', message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
