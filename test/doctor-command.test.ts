import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { initProject } from '../src/commands/init.js';
import { syncProject } from '../src/commands/sync.js';
import { runDoctor } from '../src/commands/doctor.js';
import { makeTempProject } from './helpers.js';

describe('runDoctor', () => {
  it('reports an error when .ken_spec is missing', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-missing');
    const report = await runDoctor(projectRoot);
    expect(report.ok).toBe(false);
    expect(report.findings[0].severity).toBe('error');
    expect(report.findings[0].message).toContain('ken-spec init');
  });

  it('after init but before sync, warns about missing synced skills and managed blocks', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-unsynced');
    await initProject(projectRoot);

    const report = await runDoctor(projectRoot);
    const warnings = report.findings.filter((f) => f.severity === 'warn');
    expect(report.ok).toBe(true); // warnings don't fail
    expect(warnings.some((f) => f.message.includes('codex skill missing'))).toBe(true);
    expect(warnings.some((f) => f.message.includes('claude skill missing'))).toBe(true);
    expect(warnings.some((f) => f.message.includes('AGENTS.md is missing'))).toBe(true);
    expect(warnings.some((f) => f.message.includes('CLAUDE.md is missing'))).toBe(true);
  });

  it('after init + sync, reports no errors or warnings', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-clean');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    const report = await runDoctor(projectRoot);
    expect(report.ok).toBe(true);
    const nonInfo = report.findings.filter((f) => f.severity !== 'info');
    expect(nonInfo).toEqual([]);
  });

  it('detects drift when a synced SKILL.md is hand-edited', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-drift');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    const syncedSkill = path.join(projectRoot, '.codex', 'skills', 'postmortem', 'SKILL.md');
    const original = await fs.readFile(syncedSkill, 'utf8');
    await fs.writeFile(syncedSkill, `${original}\n\nhand-edited extra line\n`, 'utf8');

    const report = await runDoctor(projectRoot);
    const driftFindings = report.findings.filter((f) =>
      f.message.includes('drift') && f.message.includes('codex')
    );
    expect(driftFindings.length).toBeGreaterThan(0);
  });

  it('warns when a rules file is missing', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-missing-rules');
    await initProject(projectRoot);

    await fs.rm(path.join(projectRoot, '.ken_spec', 'rules', 'code-style.md'));

    const report = await runDoctor(projectRoot);
    const warnings = report.findings.filter((f) => f.severity === 'warn');
    expect(warnings.some((f) => f.message.includes('code-style.md'))).toBe(true);
  });

  it('flags invalid YAML in config.yaml as an error', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-bad-yaml');
    await initProject(projectRoot);
    await fs.writeFile(
      path.join(projectRoot, '.ken_spec', 'config.yaml'),
      'injectAgentsMd: true\n  bogus: [unclosed',
      'utf8'
    );

    const report = await runDoctor(projectRoot);
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.severity === 'error' && f.message.includes('invalid YAML'))).toBe(true);
  });
});
