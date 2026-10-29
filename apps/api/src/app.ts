import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { checkReadiness, connectDB } from './config/db';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { isAllowedOrigin } from './middleware/origin';
import { authRoutes } from './routes/auth.routes';
import { workflowRoutes } from './routes/workflow.routes';
import { requestRoutes } from './routes/request.routes';
import { adminRoutes } from './routes/admin.routes';
import { delegationRoutes } from './routes/delegation.routes';
import { groupRoutes } from './routes/group.routes';
import { aiRoutes } from './routes/ai.routes';
import { orgRoutes } from './routes/org.routes';
import { checkAndEscalateRequests } from './services/slaEscalation.service';

const app = express();

// Vercel/Render sit behind a proxy; trust its X-Forwarded-For so rate
// limiting keys on the real client IP rather than the proxy's.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());

// The web app normally calls through its same-origin proxy (no CORS needed);
// this covers direct cross-origin browser calls from the configured origins.
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Liveness: the function is up. Never touches the database.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Readiness: config present and database reachable. Reports setting names and
// a coarse database state only, never values or connection details.
app.get('/health/ready', async (_req, res) => {
  const report = await checkReadiness();
  res.status(report.status === 'ok' ? 200 : 503).json(report);
});

// API routes need a live DB connection. connectDB() is cached, so this is a
// no-op after the first (warm) invocation on serverless platforms. Anything
// outside /api (e.g. "/") falls through to a plain 404 without touching the DB.
app.use('/api', async (_req, _res, next) => {
  await connectDB();
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/delegations', delegationRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/org', orgRoutes);

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
