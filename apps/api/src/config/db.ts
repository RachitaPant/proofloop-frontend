import mongoose from 'mongoose';
import { ServiceUnavailableException } from '../utils/errors';
import { migrateToOrganizations } from '../services/migration.service';

// Cached across invocations so a serverless platform (Vercel) reuses the
// connection on warm starts instead of reconnecting on every request.
let connectionPromise: Promise<typeof mongoose> | null = null;

const NOT_CONFIGURED =
  'MONGODB_URI is not set for this environment. On Vercel: Project Settings → Environment Variables → ' +
  'add MONGODB_URI (and JWT_SECRET, CORS_ALLOWED_ORIGINS, etc.) for both Production and Preview, then redeploy.';

/**
 * Connects (once) to MongoDB. Failures surface as a 503 to clients; the real
 * cause is only logged, so connection strings never leak into responses.
 */
export function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(NOT_CONFIGURED);
    return Promise.reject(new ServiceUnavailableException('Database is not configured'));
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri, { dbName: process.env.MONGODB_DATABASE || 'proofloop', serverSelectionTimeoutMS: 8000 })
      .then(async (conn) => {
        console.log('Connected to MongoDB');
        await migrateToOrganizations();
        return conn;
      })
      .catch((err: Error) => {
        connectionPromise = null; // allow retry on next invocation instead of caching a dead promise
        console.error('MongoDB connection failed:', err.message);
        throw new ServiceUnavailableException('Database is unreachable');
      });
  }

  return connectionPromise;
}

export interface ReadinessReport {
  status: 'ok' | 'unavailable';
  database: 'ok' | 'not_configured' | 'unreachable';
  /** Which required settings are missing (names only, never values). */
  missingConfig: string[];
}

const REQUIRED_CONFIG = ['MONGODB_URI', 'JWT_SECRET'] as const;

/** For /health/ready: is this deployment able to serve API requests? */
export async function checkReadiness(): Promise<ReadinessReport> {
  const missingConfig: string[] = REQUIRED_CONFIG.filter((key) => !process.env[key]);
  const secretLength = process.env.JWT_SECRET?.length ?? 0;
  if (secretLength > 0 && secretLength < 32) missingConfig.push('JWT_SECRET (must be 32+ characters)');

  let database: ReadinessReport['database'] = 'ok';
  if (!process.env.MONGODB_URI) {
    database = 'not_configured';
  } else {
    try {
      const conn = await connectDB();
      await conn.connection.db?.admin().ping();
    } catch {
      database = 'unreachable';
    }
  }

  return { status: database === 'ok' && missingConfig.length === 0 ? 'ok' : 'unavailable', database, missingConfig };
}
