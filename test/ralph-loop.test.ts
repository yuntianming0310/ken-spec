import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeTempProject } from './helpers.js';
import { initProject } from '../src/commands/init.js';
import { loadSkills } from '../src/render.js';
import { syncProject } from '../src/commands/sync.js';

describe('loadSkills — sourceDir field', () => {
  it('sets sourceDir for module-origin skills and leaves it undefined for top-level skills', async () => {
    const projectRoot = await makeTempProject('ken-spec-render-sourcedir');
    await initProject(projectRoot);

    const skills = await loadSkills(projectRoot);

    const projectSkill = skills.find((s) => s.name === 'project');
    expect(projectSkill).toBeDefined();
    expect(projectSkill!.sourceDir).toBeUndefined();

    const ralphSkill = skills.find((s) => s.name === 'ralph-loop');
    expect(ralphSkill).toBeDefined();
    expect(ralphSkill!.sourceDir).toBe(
      path.join(projectRoot, '.ken_spec', 'modules', 'ralph-loop')
    );
  });
});

describe('syncProject — ralph-loop asset mirroring', () => {
  it('mirrors prompts, rubrics, references, templates to both tool dirs', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-assets');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    const assetDirs = ['prompts', 'rubrics', 'references', 'templates'];
    for (const tool of ['.claude', '.codex']) {
      for (const assetDir of assetDirs) {
        const dirPath = path.join(projectRoot, tool, 'skills', 'ralph-loop', assetDir);
        const entries = await fs.readdir(dirPath);
        expect(entries.length).toBeGreaterThan(0);
      }
    }
  });

  it('does not sync data/ or README.md to tool dirs', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-no-data');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    for (const tool of ['.claude', '.codex']) {
      const dataPath = path.join(projectRoot, tool, 'skills', 'ralph-loop', 'data');
      await expect(fs.access(dataPath)).rejects.toThrow();

      const readmePath = path.join(projectRoot, tool, 'skills', 'ralph-loop', 'README.md');
      await expect(fs.access(readmePath)).rejects.toThrow();
    }
  });

  it('removes stray files from asset subdirs on re-sync (clean-then-copy)', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-clean');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    // Manually plant a stray file in the synced prompts dir
    const strayPath = path.join(projectRoot, '.claude', 'skills', 'ralph-loop', 'prompts', 'stray.md');
    await fs.writeFile(strayPath, 'stray', 'utf8');

    // Re-sync
    await syncProject(projectRoot);

    // Stray file must be gone
    await expect(fs.access(strayPath)).rejects.toThrow();
  });

  it('does not add asset subdirs to modules that have none (postmortem, style-review, commit-prep)', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-noop');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    for (const moduleName of ['postmortem', 'style-review', 'commit-prep']) {
      for (const tool of ['.claude', '.codex']) {
        for (const assetDir of ['prompts', 'rubrics', 'references', 'templates']) {
          const dirPath = path.join(projectRoot, tool, 'skills', moduleName, assetDir);
          await expect(fs.access(dirPath)).rejects.toThrow();
        }
      }
    }
  });

  it('sync is idempotent — running twice produces identical output', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-idempotent');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    const generatorPathFirst = await fs.readFile(
      path.join(projectRoot, '.claude', 'skills', 'ralph-loop', 'prompts', 'generator.md'),
      'utf8'
    );

    await syncProject(projectRoot);

    const generatorPathSecond = await fs.readFile(
      path.join(projectRoot, '.claude', 'skills', 'ralph-loop', 'prompts', 'generator.md'),
      'utf8'
    );

    expect(generatorPathFirst).toBe(generatorPathSecond);
  });
});
