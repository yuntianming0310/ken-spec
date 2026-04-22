import path from 'node:path';
import { ensureDir, writeFileIfMissing } from '../fs.js';
import {
  getDefaultCodeStyleRule,
  getDefaultCommand,
  getDefaultCommitPrepModuleReadme,
  getDefaultCommitPrepSkill,
  getDefaultConfigYaml,
  getDefaultPostmortemCaseTemplate,
  getDefaultPostmortemIndexTemplate,
  getDefaultPostmortemModuleReadme,
  getDefaultPostmortemModuleRules,
  getDefaultPostmortemModuleSkill,
  getDefaultPostmortemRetrospectiveTemplate,
  getDefaultProcessRule,
  getDefaultReadme,
  getDefaultRule,
  getDefaultSkill,
  getDefaultStyleReviewModuleReadme,
  getDefaultStyleReviewSkill,
} from '../templates.js';

export async function initProject(projectRoot: string): Promise<void> {
  const root = path.join(projectRoot, '.ken_spec');

  await Promise.all([
    ensureDir(path.join(root, 'rules')),
    ensureDir(path.join(root, 'skills')),
    ensureDir(path.join(root, 'commands')),
    ensureDir(path.join(root, 'modules', 'postmortem', 'templates')),
    ensureDir(path.join(root, 'modules', 'style-review')),
    ensureDir(path.join(root, 'modules', 'commit-prep')),
    ensureDir(path.join(root, 'data', 'postmortem', 'cases')),
    ensureDir(path.join(root, 'data', 'postmortem', 'retrospectives')),
    ensureDir(path.join(root, 'data', 'postmortem', 'derived-skills')),
  ]);

  await Promise.all([
    writeFileIfMissing(path.join(root, 'README.md'), getDefaultReadme()),
    writeFileIfMissing(path.join(root, 'config.yaml'), getDefaultConfigYaml()),
    writeFileIfMissing(path.join(root, 'rules', 'global.md'), getDefaultRule()),
    writeFileIfMissing(path.join(root, 'rules', 'code-style.md'), getDefaultCodeStyleRule()),
    writeFileIfMissing(path.join(root, 'rules', 'process.md'), getDefaultProcessRule()),
    writeFileIfMissing(path.join(root, 'skills', 'project.md'), getDefaultSkill()),
    writeFileIfMissing(path.join(root, 'commands', 'start.md'), getDefaultCommand()),
    writeFileIfMissing(path.join(root, 'modules', 'postmortem', 'README.md'), getDefaultPostmortemModuleReadme()),
    writeFileIfMissing(path.join(root, 'modules', 'postmortem', 'rules.md'), getDefaultPostmortemModuleRules()),
    writeFileIfMissing(path.join(root, 'modules', 'postmortem', 'skill.md'), getDefaultPostmortemModuleSkill()),
    writeFileIfMissing(path.join(root, 'modules', 'postmortem', 'templates', 'case.md'), getDefaultPostmortemCaseTemplate()),
    writeFileIfMissing(path.join(root, 'modules', 'postmortem', 'templates', 'retrospective.md'), getDefaultPostmortemRetrospectiveTemplate()),
    writeFileIfMissing(path.join(root, 'modules', 'postmortem', 'templates', 'index.md'), getDefaultPostmortemIndexTemplate()),
    writeFileIfMissing(path.join(root, 'modules', 'style-review', 'README.md'), getDefaultStyleReviewModuleReadme()),
    writeFileIfMissing(path.join(root, 'modules', 'style-review', 'skill.md'), getDefaultStyleReviewSkill()),
    writeFileIfMissing(path.join(root, 'modules', 'commit-prep', 'README.md'), getDefaultCommitPrepModuleReadme()),
    writeFileIfMissing(path.join(root, 'modules', 'commit-prep', 'skill.md'), getDefaultCommitPrepSkill()),
    writeFileIfMissing(path.join(root, 'data', 'postmortem', 'cases', '.gitkeep'), ''),
    writeFileIfMissing(path.join(root, 'data', 'postmortem', 'retrospectives', '.gitkeep'), ''),
    writeFileIfMissing(path.join(root, 'data', 'postmortem', 'derived-skills', '.gitkeep'), ''),
    writeFileIfMissing(path.join(root, 'data', 'postmortem', 'index.md'), getDefaultPostmortemIndexTemplate()),
  ]);
}
