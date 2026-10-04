import mongoose from 'mongoose';

// Cached across invocations so a serverless platform (Vercel) reuses the
// connection on warm starts instead of reconnecting on every request.
let connectionPromise: Promise<typeof mongoose> | null = null;

export function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. On Vercel: Project Settings → Environment Variables → add ' +
        'MONGODB_URI (and JWT_SECRET, CORS_ALLOWED_ORIGINS, etc.) for the Production/Preview ' +
        'environments, then redeploy.',
    );
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri, { dbName: process.env.MONGODB_DATABASE || 'proofloop' })
      .then((conn) => {
        console.log('Connected to MongoDB');
        return conn;
      })
      .catch((err) => {
        connectionPromise = null; // allow retry on next invocation instead of caching a dead promise
        throw err;
      });
  }

  return connectionPromise;
}
