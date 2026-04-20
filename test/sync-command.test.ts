import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { initProject } from '../src/commands/init.js';
import { syncProject } from '../src/commands/sync.js';
import { makeTempProject, readFile } from './helpers.js';

describe('syncProject', () => {
  it('syncs .ken_spec content into codex, claude, AGENTS.md, and CLAUDE.md', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync');

    await initProject(projectRoot);
    await syncProject(projectRoot);

    const skillPaths = [
      '.codex/skills/project/SKILL.md',
      '.codex/skills/postmortem/SKILL.md',
      '.claude/skills/project/SKILL.md',
      '.claude/skills/postmortem/SKILL.md',
      'AGENTS.md',
      'CLAUDE.md',
    ];

    for (const relativePath of skillPaths) {
      const targetPath = path.join(projectRoot, relativePath);
      await expect(fs.access(targetPath)).resolves.toBeUndefined();
    }

    const agents = await readFile(path.join(projectRoot, 'AGENTS.md'));
    const claude = await readFile(path.join(projectRoot, 'CLAUDE.md'));
    const codexPostmortem = await readFile(path.join(projectRoot, '.codex/skills/postmortem/SKILL.md'));

    expect(agents).toContain('<!-- KEN_SPEC:START -->');
    expect(claude).toContain('<!-- KEN_SPEC:START -->');
    expect(codexPostmortem).toContain('.ken_spec/modules/postmortem/rules.md');
  });
});
