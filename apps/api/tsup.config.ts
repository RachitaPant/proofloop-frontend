import { defineConfig } from 'tsup';

// Bundles the API to CommonJS in dist/. @proofloop/shared ships TypeScript
// source, so it is bundled in rather than required at runtime; everything
// else in package.json stays an external dependency.
export default defineConfig({
  entry: { app: 'src/app.ts', server: 'src/server.ts' },
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  noExternal: ['@proofloop/shared'],
  sourcemap: true,
  clean: true,
});
