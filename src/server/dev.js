import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['--watch', 'src/server/index.js'], { stdio: 'inherit' }),
  spawn('pnpm', ['exec', 'vite'], { stdio: 'inherit' })
];

function shutdown() {
  for (const p of procs) p.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
