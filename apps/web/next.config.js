// Where the API lives. The browser never calls it directly: /api/* on this
// app is proxied there, so the API's httpOnly session cookies are first-party
// cookies on this app's domain. NEXT_PUBLIC_API_URL is still read so existing
// deployments keep working without an env change; prefer API_URL going forward.
const API_ORIGIN = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @proofloop/shared ships TypeScript source; let Next compile it.
  transpilePackages: ['@proofloop/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
};

module.exports = nextConfig;
