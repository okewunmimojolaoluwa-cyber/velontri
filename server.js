/**
 * Velontri pxxl entry point — runs from /workspace/app (repo root).
 *
 * Uses process.chdir + require() to load Next.js server directly
 * without spawning a child process, so port binding is immediate.
 */
const path = require('path');
const port = parseInt(process.env.PORT || '3000', 10);
const frontendDir = path.join(__dirname, 'frontend');

// Change into frontend directory so Next.js finds .next/ and public/
process.chdir(frontendDir);
process.env.PORT = String(port);
process.env.NEXT_TELEMETRY_DISABLED = '1';

console.log(`[velontri] Starting from ${frontendDir} on port ${port}`);

// Load Next.js CLI directly — same as running `next start` but in-process
// This avoids child_process spawn delay and lets pxxl detect port immediately
const { startServer } = require(path.join(frontendDir, 'node_modules', 'next', 'dist', 'server', 'lib', 'start-server'));

startServer({
  dir: frontendDir,
  isDev: false,
  hostname: '0.0.0.0',
  port,
  allowRetry: false,
}).catch((err) => {
  console.error('[velontri] Failed to start:', err);
  process.exit(1);
});
