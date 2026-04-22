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
      '.codex/skills/style-review/SKILL.md',
      '.codex/skills/commit-prep/SKILL.md',
      '.claude/skills/project/SKILL.md',
      '.claude/skills/postmortem/SKILL.md',
      '.claude/skills/style-review/SKILL.md',
      '.claude/skills/commit-prep/SKILL.md',
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
    const codexStyleReview = await readFile(path.join(projectRoot, '.codex/skills/style-review/SKILL.md'));
    const codexCommitPrep = await readFile(path.join(projectRoot, '.codex/skills/commit-prep/SKILL.md'));

    expect(agents).toContain('<!-- KEN_SPEC:START -->');
    expect(agents).toContain('Mandatory reads');
    expect(agents).toContain('.ken_spec/rules/code-style.md');
    expect(agents).toContain('.ken_spec/rules/process.md');
    expect(claude).toContain('<!-- KEN_SPEC:START -->');
    expect(claude).toContain('Mandatory reads');
    expect(claude).toContain('.ken_spec/rules/code-style.md');
    expect(claude).toContain('.ken_spec/rules/process.md');
    expect(codexPostmortem).toContain('.ken_spec/modules/postmortem/rules.md');
    expect(codexStyleReview).toContain('.ken_spec/rules/code-style.md');
    expect(codexCommitPrep).toContain('.ken_spec/rules/process.md');
  });
});
