// Bundles the game server (and the rules it runs) into one file for the VPS:
// no TypeScript, no workspace packages, no node_modules to install there.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // `ws` is CommonJS and calls require(): give the ES module a require.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  // Optional speed-ups that `ws` loads only if installed.
  external: ['bufferutil', 'utf-8-validate'],
  logLevel: 'info',
});
