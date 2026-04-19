import { chmod, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await rm(new URL('./dist', import.meta.url), { recursive: true, force: true });

const result = spawnSync('npx', ['tsc', '-p', 'tsconfig.json'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

await chmod(new URL('./dist/bin.js', import.meta.url), 0o755);
