import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Starting StudyMate AI Full-Stack Application...');

// Start Backend Express Server
const server = spawn('npm.cmd', ['run', 'dev'], {
  cwd: path.resolve('server'),
  stdio: 'inherit',
  shell: true
});

server.on('error', (err) => {
  console.error('❌ Failed to start Express backend:', err);
});

// Start Frontend Vite Dev Server
const client = spawn('npm.cmd', ['run', 'dev'], {
  cwd: path.resolve('client'),
  stdio: 'inherit',
  shell: true
});

client.on('error', (err) => {
  console.error('❌ Failed to start Vite frontend:', err);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down StudyMate AI processes...');
  server.kill();
  client.kill();
  process.exit();
});
