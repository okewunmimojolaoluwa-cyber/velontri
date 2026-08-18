/**
 * Root-level pxxl start wrapper for Velontri.
 * pxxl runs this from the repo root with PORT set in environment.
 */
const { spawn } = require('child_process');
const path = require('path');

const port = process.env.PORT || '3000';
const host = '0.0.0.0';
const frontendDir = path.join(__dirname, 'frontend');

console.log(`[velontri] Starting Next.js on ${host}:${port} (cwd: ${frontendDir})`);

const next = spawn(
  'node',
  [path.join(frontendDir, 'node_modules', '.bin', 'next'), 'start', '-p', port, '-H', host],
  {
    stdio: 'inherit',
    env: { ...process.env, PORT: port },
    cwd: frontendDir,
  }
);

next.on('error', (err) => {
  console.error('[velontri] Failed to start:', err.message);
  process.exit(1);
});

next.on('close', (code) => {
  console.log(`[velontri] Next.js exited with code ${code}`);
  process.exit(code ?? 1);
});

process.on('SIGTERM', () => next.kill('SIGTERM'));
process.on('SIGINT',  () => next.kill('SIGINT'));
