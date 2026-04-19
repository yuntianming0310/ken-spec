import path from 'node:path';
import { loadConfig } from '../config.js';
import { readTextOrEmpty, writeText } from '../fs.js';
import { updateManagedBlock } from '../markers.js';
import { loadSkills, renderRootManagedBlock, renderSkillFile } from '../render.js';
export async function syncProject(projectRoot) {
    const config = await loadConfig(projectRoot);
    const skills = await loadSkills(projectRoot);
    if (config.codex.enabled) {
        await syncSkillsToTool(projectRoot, '.codex', skills);
    }
    if (config.claude.enabled) {
        await syncSkillsToTool(projectRoot, '.claude', skills);
    }
    const block = renderRootManagedBlock();
    if (config.injectAgentsMd) {
        await syncManagedRootFile(path.join(projectRoot, 'AGENTS.md'), block);
    }
    if (config.injectClaudeMd) {
        await syncManagedRootFile(path.join(projectRoot, 'CLAUDE.md'), block);
    }
}
async function syncSkillsToTool(projectRoot, toolDir, skills) {
    for (const skill of skills) {
        const targetPath = path.join(projectRoot, toolDir, 'skills', skill.name, 'SKILL.md');
        await writeText(targetPath, renderSkillFile(skill));
    }
}
async function syncManagedRootFile(filePath, block) {
    const existing = await readTextOrEmpty(filePath);
    await writeText(filePath, updateManagedBlock(existing, block));
}
