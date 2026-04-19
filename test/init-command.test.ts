import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeTempProject } from './helpers.js';
import { initProject } from '../src/commands/init.js';

describe('initProject', () => {
  it('creates the default .ken_spec structure', async () => {
    const projectRoot = await makeTempProject('ken-spec-init');

    await initProject(projectRoot);

    const expectedPaths = [
      '.ken_spec/README.md',
      '.ken_spec/config.yaml',
      '.ken_spec/rules/global.md',
      '.ken_spec/skills/project.md',
      '.ken_spec/commands/start.md',
      '.ken_spec/modules/postmortem/README.md',
      '.ken_spec/modules/postmortem/skill.md',
      '.ken_spec/modules/postmortem/templates/case.md',
      '.ken_spec/modules/postmortem/templates/retrospective.md',
      '.ken_spec/modules/postmortem/templates/index.md',
      '.ken_spec/data/postmortem/cases/.gitkeep',
      '.ken_spec/data/postmortem/retrospectives/.gitkeep',
      '.ken_spec/data/postmortem/derived-skills/.gitkeep',
      '.ken_spec/data/postmortem/index.md',
    ];

    for (const relativePath of expectedPaths) {
      const targetPath = path.join(projectRoot, relativePath);
      await expect(fs.access(targetPath)).resolves.toBeUndefined();
    }
  });
});
