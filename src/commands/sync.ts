import path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadConfig } from '../config.js';
import { ensureDir, readTextOrEmpty, writeText } from '../fs.js';
import { updateManagedBlock } from '../markers.js';
import { loadSkills, renderRootManagedBlock, renderSkillFile } from '../render.js';

const ASSET_SUBDIRS = ['prompts', 'rubrics', 'references', 'templates'] as const;

export async function syncProject(projectRoot: string): Promise<void> {
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

async function syncSkillsToTool(
  projectRoot: string,
  toolDir: string,
  skills: Array<{ name: string; content: string; sourceDir?: string }>
): Promise<void> {
  for (const skill of skills) {
    const skillOutputDir = path.join(projectRoot, toolDir, 'skills', skill.name);
    const targetPath = path.join(skillOutputDir, 'SKILL.md');
    await writeText(targetPath, renderSkillFile(skill));

    if (skill.sourceDir !== undefined) {
      await mirrorModuleAssets(skill.sourceDir, skillOutputDir);
    }
  }
}

/**
 * For each whitelisted asset subdir present under moduleSrcDir, remove the
 * corresponding subdir at moduleDstDir then recursively copy from source.
 * Excluded: `data/` and the module's `README.md`.
 */
async function mirrorModuleAssets(
  moduleSrcDir: string,
  moduleDstDir: string
): Promise<void> {
  for (const assetDir of ASSET_SUBDIRS) {
    const srcDir = path.join(moduleSrcDir, assetDir);
    const dstDir = path.join(moduleDstDir, assetDir);

    // Check source exists
    try {
      await fs.access(srcDir);
    } catch {
      // Source subdir doesn't exist — no-op for this subdir
      continue;
    }

    // Clean destination
    try {
      await fs.rm(dstDir, { recursive: true, force: true });
    } catch {
      // Destination didn't exist — fine
    }

    // Ensure destination parent exists and copy
    await ensureDir(moduleDstDir);
    await fs.cp(srcDir, dstDir, { recursive: true });
  }
}

async function syncManagedRootFile(filePath: string, block: string): Promise<void> {
  const existing = await readTextOrEmpty(filePath);
  await writeText(filePath, updateManagedBlock(existing, block));
}
