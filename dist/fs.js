import path from 'node:path';
import { promises as fs } from 'node:fs';
export async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
export async function writeFileIfMissing(filePath, content) {
    try {
        await fs.access(filePath);
    }
    catch {
        await ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content, 'utf8');
    }
}
export async function writeText(filePath, content) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf8');
}
export async function readTextOrEmpty(filePath) {
    try {
        return await fs.readFile(filePath, 'utf8');
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code === 'ENOENT') {
            return '';
        }
        throw error;
    }
}
