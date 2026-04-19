import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export async function makeTempProject(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}
