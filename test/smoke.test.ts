import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

describe('smoke', () => {
  it('runs tests', () => {
    expect(true).toBe(true);
  });

  it('keeps a node shebang on the CLI entrypoint source', async () => {
    const binSource = await readFile(path.join(process.cwd(), 'src', 'bin.ts'), 'utf8');
    expect(binSource.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('uses the ken-spec package name', async () => {
    const packageJson = await readFile(path.join(process.cwd(), 'package.json'), 'utf8');
    expect(packageJson).toContain('"name": "ken-spec"');
  });
});
