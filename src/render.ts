import type { Dirent } from 'node:fs';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { renderManagedBlock } from './markers.js';

export interface SkillSource {
  name: string;
  content: string;
  /** Absolute path to the module directory. Defined only for module-origin skills. */
  sourceDir?: string;
}

export async function loadSkills(projectRoot: string): Promise<SkillSource[]> {
  const skillsDir = path.join(projectRoot, '.ken_spec', 'skills');
  const topLevelSkills = await loadMarkdownSkills(skillsDir);
  const moduleSkills = await loadModuleSkills(path.join(projectRoot, '.ken_spec', 'modules'));

  return [...topLevelSkills, ...moduleSkills];
}

export function renderSkillFile(skill: SkillSource): string {
  return [
    '---',
    `name: ${skill.name}`,
    `description: Synced from .ken_spec/skills/${skill.name}.md`,
    '---',
    '',
    skill.content.trim(),
    '',
  ].join('\n');
}

export function renderRootManagedBlock(): string {
  return renderManagedBlock([
    'This project uses Ken Spec. Rules below are binding for all work in this repo.',
    '',
    '## Mandatory reads',
    '',
    'Before writing or modifying code, read:',
    '- `.ken_spec/rules/code-style.md`',
    '',
    'Before preparing a commit, branch, or PR, read:',
    '- `.ken_spec/rules/process.md`',
    '',
    'General project rules:',
    '- `.ken_spec/rules/global.md`',
    '',
    'If a rule conflicts with the current task, pause and ask the user.',
    '',
    '## Reference',
    '- `.ken_spec/README.md` — project overview',
    '- `.ken_spec/rules/` — full rules directory',
    '- `.ken_spec/modules/` — structured skill modules (postmortem, style-review, commit-prep, …)',
  ].join('\n'));
}

async function loadMarkdownSkills(dirPath: string): Promise<SkillSource[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .sort((left, right) => left.name.localeCompare(right.name));

  return Promise.all(markdownFiles.map(async (entry) => ({
    name: path.basename(entry.name, '.md'),
    content: await fs.readFile(path.join(dirPath, entry.name), 'utf8'),
  })));
}

async function loadModuleSkills(modulesDir: string): Promise<SkillSource[]> {
  const entries = await readDirOrEmpty(modulesDir);
  const moduleDirs = entries.filter((entry) => entry.isDirectory()).sort((left, right) => left.name.localeCompare(right.name));
  const skills: SkillSource[] = [];

  for (const moduleDir of moduleDirs) {
    const skillPath = path.join(modulesDir, moduleDir.name, 'skill.md');
    try {
      const content = await fs.readFile(skillPath, 'utf8');
      skills.push({
        name: moduleDir.name,
        content,
        sourceDir: path.join(modulesDir, moduleDir.name),
      });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return skills;
}

async function readDirOrEmpty(dirPath: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
