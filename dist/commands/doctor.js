import path from 'node:path';
import { promises as fs } from 'node:fs';
import { parse } from 'yaml';
import { loadConfig } from '../config.js';
import { readTextOrEmpty } from '../fs.js';
import { END_MARKER, START_MARKER } from '../markers.js';
import { loadSkills, renderRootManagedBlock, renderSkillFile } from '../render.js';
export async function runDoctor(projectRoot) {
    const findings = [];
    const kenSpecDir = path.join(projectRoot, '.ken_spec');
    if (!(await exists(kenSpecDir))) {
        findings.push({
            severity: 'error',
            message: '.ken_spec/ not found — run `ken-spec init` first',
        });
        return finalize(findings);
    }
    // Config: exists + parses as YAML.
    const configPath = path.join(kenSpecDir, 'config.yaml');
    const rawConfig = await readTextOrEmpty(configPath);
    if (!rawConfig.trim()) {
        findings.push({
            severity: 'warn',
            message: '.ken_spec/config.yaml is empty or missing — defaults will be used',
        });
    }
    else {
        try {
            parse(rawConfig);
        }
        catch (error) {
            findings.push({
                severity: 'error',
                message: `.ken_spec/config.yaml is invalid YAML: ${error.message}`,
            });
        }
    }
    let config;
    try {
        config = await loadConfig(projectRoot);
    }
    catch (error) {
        findings.push({
            severity: 'error',
            message: `failed to load config: ${error.message}`,
        });
        return finalize(findings);
    }
    // Skill sources.
    const skills = await loadSkills(projectRoot);
    if (skills.length === 0) {
        findings.push({
            severity: 'warn',
            message: 'no skills found under .ken_spec/skills/ or .ken_spec/modules/*/skill.md',
        });
    }
    // Drift + missing for each enabled tool.
    const targets = [
        { enabled: config.codex.enabled, toolDir: '.codex', label: 'codex' },
        { enabled: config.claude.enabled, toolDir: '.claude', label: 'claude' },
    ];
    for (const target of targets) {
        if (!target.enabled)
            continue;
        for (const skill of skills) {
            const syncedPath = path.join(projectRoot, target.toolDir, 'skills', skill.name, 'SKILL.md');
            const actual = await readTextOrEmpty(syncedPath);
            const rel = path.relative(projectRoot, syncedPath);
            if (!actual) {
                findings.push({
                    severity: 'warn',
                    message: `${target.label} skill missing: ${rel} — run \`ken-spec sync\``,
                });
                continue;
            }
            const expected = renderSkillFile(skill);
            if (normalize(actual) !== normalize(expected)) {
                findings.push({
                    severity: 'warn',
                    message: `${target.label} skill drift: ${rel} differs from source — rerun \`ken-spec sync\` (hand-edits to generated SKILL.md will be lost; copy them back into the source first)`,
                });
            }
        }
    }
    // Managed block presence in root MD files.
    const rootChecks = [
        { enabled: config.injectAgentsMd, file: 'AGENTS.md' },
        { enabled: config.injectClaudeMd, file: 'CLAUDE.md' },
    ];
    const expectedBlock = renderRootManagedBlock();
    for (const check of rootChecks) {
        if (!check.enabled)
            continue;
        const filePath = path.join(projectRoot, check.file);
        const content = await readTextOrEmpty(filePath);
        if (!content.includes(START_MARKER)) {
            findings.push({
                severity: 'warn',
                message: `${check.file} is missing the Ken Spec managed block — run \`ken-spec sync\``,
            });
            continue;
        }
        const actualBlock = extractManagedBlock(content);
        if (actualBlock === undefined) {
            findings.push({
                severity: 'warn',
                message: `${check.file} has a malformed Ken Spec managed block — run \`ken-spec sync\``,
            });
            continue;
        }
        if (normalize(actualBlock) !== normalize(expectedBlock)) {
            findings.push({
                severity: 'warn',
                message: `${check.file} managed block is stale — run \`ken-spec sync\``,
            });
        }
    }
    // Team-conventions rules files (code-style.md, process.md).
    const conventionRules = [
        {
            file: 'code-style.md',
            sections: ['Naming', 'Formatting', 'Type safety', 'Comments', 'Imports', 'Errors'],
        },
        {
            file: 'process.md',
            sections: [
                'Commit messages',
                'Branches',
                'Pull requests & code review',
                'Testing requirements',
                'Release',
            ],
        },
    ];
    for (const rule of conventionRules) {
        const rulePath = path.join(kenSpecDir, 'rules', rule.file);
        if (!(await exists(rulePath))) {
            findings.push({
                severity: 'warn',
                message: `rules/${rule.file} is missing — restore it or run \`ken-spec init\` in an empty subdir to regenerate`,
            });
            continue;
        }
        const content = await readTextOrEmpty(rulePath);
        for (const section of rule.sections) {
            if (!content.includes(section)) {
                findings.push({
                    severity: 'info',
                    message: `rules/${rule.file} is missing expected section "${section}"`,
                });
            }
        }
    }
    // Postmortem rules.md sanity (only if the module is present).
    const rulesPath = path.join(kenSpecDir, 'modules', 'postmortem', 'rules.md');
    if (await exists(rulesPath)) {
        const rules = await readTextOrEmpty(rulesPath);
        const sections = [
            'When to capture',
            'What to record',
            'Where to store',
            'Output rules',
        ];
        for (const section of sections) {
            if (!rules.includes(section)) {
                findings.push({
                    severity: 'info',
                    message: `postmortem rules.md is missing expected section "${section}"`,
                });
            }
        }
    }
    return finalize(findings);
}
export function summarizeReport(report) {
    const counts = { error: 0, warn: 0, info: 0 };
    for (const finding of report.findings)
        counts[finding.severity]++;
    return `${counts.error} error(s), ${counts.warn} warning(s), ${counts.info} info`;
}
function finalize(findings) {
    const ok = !findings.some((f) => f.severity === 'error');
    return { findings, ok };
}
function extractManagedBlock(content) {
    const startIndex = content.indexOf(START_MARKER);
    const endIndex = content.indexOf(END_MARKER);
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        return undefined;
    }
    return content.slice(startIndex, endIndex + END_MARKER.length);
}
function normalize(content) {
    return content.replace(/\r\n/g, '\n').trim();
}
async function exists(p) {
    try {
        await fs.access(p);
        return true;
    }
    catch {
        return false;
    }
}
