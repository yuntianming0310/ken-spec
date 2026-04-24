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

  it('mirrors whitelist subdirs only when present in source (postmortem gets templates; style-review and commit-prep stay bare)', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-noop');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    // style-review and commit-prep have no whitelist subdirs in source → none at destination.
    for (const moduleName of ['style-review', 'commit-prep']) {
      for (const tool of ['.claude', '.codex']) {
        for (const assetDir of ['prompts', 'rubrics', 'references', 'templates']) {
          const dirPath = path.join(projectRoot, tool, 'skills', moduleName, assetDir);
          await expect(fs.access(dirPath)).rejects.toThrow();
        }
      }
    }

    // postmortem has templates/ in source → templates/ mirrored; no prompts/rubrics/references.
    for (const tool of ['.claude', '.codex']) {
      const templatesPath = path.join(projectRoot, tool, 'skills', 'postmortem', 'templates');
      await expect(fs.access(templatesPath)).resolves.toBeUndefined();
      for (const assetDir of ['prompts', 'rubrics', 'references']) {
        const dirPath = path.join(projectRoot, tool, 'skills', 'postmortem', assetDir);
        await expect(fs.access(dirPath)).rejects.toThrow();
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

describe('initProject — ralph-loop scaffolding', () => {
  it('creates all ralph-loop source files', async () => {
    const projectRoot = await makeTempProject('ken-spec-init-ralph');
    await initProject(projectRoot);

    const expectedPaths = [
      '.ken_spec/modules/ralph-loop/README.md',
      '.ken_spec/modules/ralph-loop/skill.md',
      '.ken_spec/modules/ralph-loop/prompts/generator.md',
      '.ken_spec/modules/ralph-loop/prompts/evaluator.md',
      '.ken_spec/modules/ralph-loop/prompts/assembler.md',
      '.ken_spec/modules/ralph-loop/rubrics/README.md',
      '.ken_spec/modules/ralph-loop/rubrics/one-pager.yaml',
      '.ken_spec/modules/ralph-loop/rubrics/assembly.yaml',
      '.ken_spec/modules/ralph-loop/references/host-profiles.md',
      '.ken_spec/modules/ralph-loop/references/decomposition-heuristics.md',
      '.ken_spec/modules/ralph-loop/references/iteration-log-schema.md',
      '.ken_spec/modules/ralph-loop/templates/task-spec.md',
      '.ken_spec/modules/ralph-loop/templates/run-dir-readme.md',
      '.ken_spec/data/ralph-loop/runs/.gitkeep',
    ];

    for (const relativePath of expectedPaths) {
      const targetPath = path.join(projectRoot, relativePath);
      await expect(fs.access(targetPath)).resolves.toBeUndefined();
    }
  });

  it('scaffolded skill.md and prompt files are non-empty', async () => {
    const projectRoot = await makeTempProject('ken-spec-init-ralph-nonempty');
    await initProject(projectRoot);

    const filesToCheck = [
      '.ken_spec/modules/ralph-loop/skill.md',
      '.ken_spec/modules/ralph-loop/prompts/generator.md',
      '.ken_spec/modules/ralph-loop/prompts/evaluator.md',
      '.ken_spec/modules/ralph-loop/prompts/assembler.md',
    ];

    for (const relativePath of filesToCheck) {
      const content = await fs.readFile(path.join(projectRoot, relativePath), 'utf8');
      expect(content.trim().length).toBeGreaterThan(0);
    }
  });
});
