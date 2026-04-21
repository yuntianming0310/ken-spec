import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { initProject } from '../src/commands/init.js';
import { syncProject } from '../src/commands/sync.js';
import { cleanProject } from '../src/commands/clean.js';
import { makeTempProject, readFile } from './helpers.js';

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe('cleanProject', () => {
  it('removes synced skill dirs and strips managed blocks from root MD files', async () => {
    const projectRoot = await makeTempProject('ken-spec-clean');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    // Pre-condition: sync produced the expected artifacts.
    const targets = [
      '.codex/skills/project/SKILL.md',
      '.codex/skills/postmortem/SKILL.md',
      '.claude/skills/project/SKILL.md',
      '.claude/skills/postmortem/SKILL.md',
    ];
    for (const rel of targets) {
      expect(await exists(path.join(projectRoot, rel))).toBe(true);
    }

    await cleanProject(projectRoot);

    for (const rel of targets) {
      expect(await exists(path.join(projectRoot, rel))).toBe(false);
    }

    // The `.codex/skills/` + `.claude/skills/` parent dirs should be tidied up too.
    expect(await exists(path.join(projectRoot, '.codex', 'skills'))).toBe(false);
    expect(await exists(path.join(projectRoot, '.claude', 'skills'))).toBe(false);

    // AGENTS.md / CLAUDE.md were created by sync and contained only the managed
    // block — clean should delete them outright.
    expect(await exists(path.join(projectRoot, 'AGENTS.md'))).toBe(false);
    expect(await exists(path.join(projectRoot, 'CLAUDE.md'))).toBe(false);

    // The source of truth is untouched.
    expect(await exists(path.join(projectRoot, '.ken_spec', 'config.yaml'))).toBe(true);
    expect(await exists(path.join(projectRoot, '.ken_spec', 'modules', 'postmortem', 'rules.md'))).toBe(true);
  });

  it('preserves user content in AGENTS.md outside the managed block', async () => {
    const projectRoot = await makeTempProject('ken-spec-clean-user-content');
    await initProject(projectRoot);

    const agentsPath = path.join(projectRoot, 'AGENTS.md');
    await fs.writeFile(agentsPath, '# My Notes\n\nHand-written intro.\n', 'utf8');

    await syncProject(projectRoot);
    const afterSync = await readFile(agentsPath);
    expect(afterSync).toContain('# My Notes');
    expect(afterSync).toContain('Hand-written intro.');
    expect(afterSync).toContain('<!-- KEN_SPEC:START -->');

    await cleanProject(projectRoot);

    // File should still exist with the user's content, minus the managed block.
    expect(await exists(agentsPath)).toBe(true);
    const afterClean = await readFile(agentsPath);
    expect(afterClean).toContain('# My Notes');
    expect(afterClean).toContain('Hand-written intro.');
    expect(afterClean).not.toContain('KEN_SPEC:START');
  });

  it('dry-run does not modify anything', async () => {
    const projectRoot = await makeTempProject('ken-spec-clean-dry-run');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    const before = await readFile(path.join(projectRoot, 'AGENTS.md'));

    const plan = await cleanProject(projectRoot, { dryRun: true });

    expect(plan.skillDirs.length).toBeGreaterThan(0);
    expect(plan.rootFiles.length).toBe(2);

    // Nothing actually deleted.
    expect(await exists(path.join(projectRoot, '.codex', 'skills', 'postmortem'))).toBe(true);
    expect(await readFile(path.join(projectRoot, 'AGENTS.md'))).toBe(before);
  });
});
