import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['dist/server.js'], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, ['dist/worker.js'], { stdio: 'inherit', env: process.env })
];

let shuttingDown = false;
let remaining = children.length;

function stop(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(signal));
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    remaining -= 1;
    if (!shuttingDown) stop();
    if (remaining === 0) process.exitCode = code ?? (signal ? 1 : 0);
  });
  child.on('error', (error) => {
    console.error('Could not start process:', error);
    stop();
  });
}
