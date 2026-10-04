/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @proofloop/shared ships TypeScript source; let Next compile it.
  transpilePackages: ['@proofloop/shared'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },
};

module.exports = nextConfig;
