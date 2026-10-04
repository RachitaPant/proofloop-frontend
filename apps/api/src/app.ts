import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { connectDB } from './config/db';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth.routes';
import { workflowRoutes } from './routes/workflow.routes';
import { requestRoutes } from './routes/request.routes';
import { adminRoutes } from './routes/admin.routes';
import { checkAndEscalateRequests } from './services/slaEscalation.service';

const app = express();

// Vercel/Render sit behind a proxy; trust its X-Forwarded-For so rate
// limiting keys on the real client IP rather than the proxy's.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map((o) => o.trim());
app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

app.use(express.json({ limit: '100kb' }));

// Brute-force protection for login/register. The default in-memory store is
// per-instance: on Vercel each warm function instance has its own counter,
// so this is a speed bump rather than a hard global limit. Swap in a shared
// store (e.g. Upstash Redis) if you need a strict cross-instance limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 429, error: 'Too Many Requests', message: 'Too many attempts, please try again later.' },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Every other route needs a live DB connection. connectDB() is cached, so
// this is a no-op after the first (warm) invocation on serverless platforms.
app.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);

// Unauthenticated-but-secret-gated hook for Vercel Cron (which can only send
// scheduled GET requests, not a user's JWT). Set CRON_SECRET; the schedule
// lives in vercel.json (daily on the Hobby plan). On Render/local, the
// in-process scheduler in server.ts covers this instead.
app.get('/api/cron/sla-escalation', async (req, res) => {
  const expected = Buffer.from(process.env.CRON_SECRET || '');
  const provided = Buffer.from((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (expected.length === 0 || provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  const escalatedCount = await checkAndEscalateRequests();
  res.json({ message: 'SLA escalation check triggered', escalatedCount });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
