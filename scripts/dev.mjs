// Starts both MCP servers and the web UI together; Ctrl+C stops all three.
import { spawn } from 'node:child_process';

const procs = ['mcp:inbox', 'mcp:payments', 'web'].map((script) =>
  spawn('npm', ['run', '--silent', script], { stdio: 'inherit' }),
);

const stop = () => procs.forEach((p) => p.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => code && stop()));
