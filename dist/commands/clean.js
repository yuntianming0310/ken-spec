import path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadConfig } from '../config.js';
import { readTextOrEmpty, writeText } from '../fs.js';
import { removeManagedBlock, START_MARKER } from '../markers.js';
import { loadSkills } from '../render.js';
export async function planClean(projectRoot) {
    const config = await loadConfig(projectRoot);
    const skills = await loadSkills(projectRoot);
    const skillDirs = [];
    const rootFiles = [];
    if (config.codex.enabled) {
        for (const skill of skills) {
            skillDirs.push(path.join(projectRoot, '.codex', 'skills', skill.name));
        }
    }
    if (config.claude.enabled) {
        for (const skill of skills) {
            skillDirs.push(path.join(projectRoot, '.claude', 'skills', skill.name));
        }
    }
    if (config.injectAgentsMd) {
        rootFiles.push(path.join(projectRoot, 'AGENTS.md'));
    }
    if (config.injectClaudeMd) {
        rootFiles.push(path.join(projectRoot, 'CLAUDE.md'));
    }
    return { skillDirs, rootFiles, removedRootFiles: [] };
}
export async function cleanProject(projectRoot, options = {}) {
    const plan = await planClean(projectRoot);
    if (options.dryRun) {
        return plan;
    }
    for (const dir of plan.skillDirs) {
        await removeDirIfExists(dir);
        // Tidy up empty parent `.codex/skills/` or `.claude/skills/` dir.
        await removeDirIfEmpty(path.dirname(dir));
    }
    const removedRootFiles = [];
    for (const filePath of plan.rootFiles) {
        const existing = await readTextOrEmpty(filePath);
        if (!existing || !existing.includes(START_MARKER)) {
            continue;
        }
        const updated = removeManagedBlock(existing);
        if (updated.length === 0) {
            await unlinkIfExists(filePath);
            removedRootFiles.push(filePath);
        }
        else {
            await writeText(filePath, updated);
        }
    }
    return { ...plan, removedRootFiles };
}
async function removeDirIfExists(dirPath) {
    try {
        await fs.rm(dirPath, { recursive: true, force: true });
    }
    catch (error) {
        const code = error.code;
        if (code !== 'ENOENT')
            throw error;
    }
}
async function removeDirIfEmpty(dirPath) {
    try {
        const entries = await fs.readdir(dirPath);
        if (entries.length === 0) {
            await fs.rmdir(dirPath);
        }
    }
    catch {
        // Missing or non-empty — nothing to do.
    }
}
async function unlinkIfExists(filePath) {
    try {
        await fs.unlink(filePath);
    }
    catch (error) {
        const code = error.code;
        if (code !== 'ENOENT')
            throw error;
    }
}
