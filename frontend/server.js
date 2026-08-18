/**
 * Velontri pxxl start wrapper.
 * Reads PORT from environment (pxxl injects this), falls back to 3000.
 * Spawns next start bound to 0.0.0.0 so pxxl's proxy can reach it.
 */
const { spawn } = require('child_process');
const port = process.env.PORT || '3000';
const host = '0.0.0.0';

console.log(`[velontri] Starting Next.js on ${host}:${port}`);

const next = spawn(
  'node',
  ['node_modules/.bin/next', 'start', '-p', port, '-H', host],
  {
    stdio: 'inherit',
    env: { ...process.env, PORT: port },
    cwd: __dirname,
  }
);

next.on('close', (code) => {
  console.log(`[velontri] Next.js exited with code ${code}`);
  process.exit(code ?? 1);
});

process.on('SIGTERM', () => next.kill('SIGTERM'));
process.on('SIGINT',  () => next.kill('SIGINT'));
