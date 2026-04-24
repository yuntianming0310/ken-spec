import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeTempProject } from './helpers.js';
import { initProject } from '../src/commands/init.js';
import { loadSkills } from '../src/render.js';

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
