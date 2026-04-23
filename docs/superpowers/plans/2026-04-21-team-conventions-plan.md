# Team Conventions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ken-spec a first-class way to capture team code-style and process conventions that are shared via git, delivered to agents both always-on (through the root managed block) and on-demand (through two new `modules/` skills).

**Architecture:** Add two rule files under `.ken_spec/rules/` (`code-style.md`, `process.md`) as the single source of truth. Add two new modules (`style-review/`, `commit-prep/`) whose `skill.md` files consume those rules. Rewrite `renderRootManagedBlock()` to reference the rules with explicit trigger verbs. Extend `doctor` with three checks: missing rules file, empty section skeleton, and managed-block drift. No changes to `sync`, `clean`, or `markers`; the new modules are picked up transparently by `loadModuleSkills()`.

**Tech Stack:** Node.js ≥20.19, TypeScript (ESM, NodeNext), Commander, YAML, Vitest.

**Repo layout reminders:**
- All source paths are relative to `/Users/wenbokang/projects/ken-spec`.
- ESM with NodeNext — imports use explicit `.js` extensions even for TS sources.
- Test runner: `npm test -- --run <path>` for a single file, `npm test` for everything.
- Commit style: Conventional Commits (`feat: …`, `test: …`, etc.), one line.

---

### Task 1: Add template helpers for the six new scaffolded files

**Files:**
- Modify: `src/templates.ts`

- [ ] **Step 1: Append `getDefaultCodeStyleRule`**

Append this function to `src/templates.ts` (after the existing `getDefaultPostmortemIndexTemplate`):

```ts
export function getDefaultCodeStyleRule(): string {
  return [
    '# Code Style Rules',
    '',
    'Edit this file to define code-style rules for this project. Agents read it before writing or modifying code.',
    '',
    'Each section below is a contract with the agent. Keep bullets concrete — vague rules get ignored.',
    '',
    '## Naming',
    '',
    '<!-- Identifier casing, abbreviation policy, file-naming rules. -->',
    '',
    '- example: use `camelCase` for variables and functions',
    '',
    '## Formatting',
    '',
    '<!-- Indentation, line length, quote style, trailing commas, etc. -->',
    '',
    '- example: 2-space indent, max line length 100',
    '',
    '## Type safety',
    '',
    '<!-- When to use explicit types, nullability, generics, narrowing. -->',
    '',
    '- example: no `any` in production code; prefer `unknown` + narrowing',
    '',
    '## Comments',
    '',
    '<!-- When comments are required, banned, or must follow a template. -->',
    '',
    '- example: document the WHY, not the WHAT',
    '',
    '## Imports',
    '',
    '<!-- Ordering, grouping, path aliases, side-effect imports. -->',
    '',
    '- example: node builtins → third-party → local, separated by blank lines',
    '',
    '## Errors',
    '',
    '<!-- How errors are thrown, wrapped, logged, and surfaced. -->',
    '',
    '- example: never swallow errors silently; attach context when rethrowing',
    '',
  ].join('\n');
}
```

- [ ] **Step 2: Append `getDefaultProcessRule`**

```ts
export function getDefaultProcessRule(): string {
  return [
    '# Process Rules',
    '',
    'Edit this file to define process rules for this project. Agents read it before preparing a commit, branch, or PR.',
    '',
    'Each section below is a contract with the agent. Keep bullets concrete — vague rules get ignored.',
    '',
    '## Commit messages',
    '',
    '<!-- Format, subject length, body requirements, footer/trailers. -->',
    '',
    '- example: Conventional Commits (`type(scope): subject`), subject ≤ 72 chars',
    '',
    '## Branches',
    '',
    '<!-- Naming convention, base branch, lifetime. -->',
    '',
    '- example: `feat/<short-slug>`, branched from `main`',
    '',
    '## Pull requests & code review',
    '',
    '<!-- Required reviewers, description template, labels. -->',
    '',
    '- example: PR description must list Summary, Testing, Risks',
    '',
    '## Testing requirements',
    '',
    '<!-- What must be tested before a PR is opened. -->',
    '',
    '- example: run full test suite locally; new code requires a unit test',
    '',
    '## Release',
    '',
    '<!-- Tagging, changelog, deployment steps. -->',
    '',
    '- example: bump version in `package.json`; tag `vX.Y.Z`; publish via CI',
    '',
  ].join('\n');
}
```

- [ ] **Step 3: Append `getDefaultStyleReviewModuleReadme`**

```ts
export function getDefaultStyleReviewModuleReadme(): string {
  return [
    '# Style Review Module',
    '',
    'Provides the `style-review` skill to Codex and Claude.',
    '',
    'Rules live in `.ken_spec/rules/code-style.md` — edit that file to tune what counts as a violation. The skill reads it at runtime, so changes take effect without `ken-spec sync`.',
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Append `getDefaultStyleReviewSkill`**

```ts
export function getDefaultStyleReviewSkill(): string {
  return [
    '# Code Style Review Skill',
    '',
    'Use this when the user asks to review code for style, consistency, or pre-commit cleanup.',
    '',
    '## How',
    '',
    '1. Read `.ken_spec/rules/code-style.md` — that file is the source of truth.',
    '2. For each file in scope, walk through the rule sections (Naming, Formatting, Type safety, Comments, Imports, Errors).',
    '3. Report violations with `file:line` pointers and suggested fixes.',
    "4. Don't auto-fix unless the user asks.",
    '',
    'If `rules/code-style.md` is missing or a section is empty, pause and ask.',
    '',
  ].join('\n');
}
```

- [ ] **Step 5: Append `getDefaultCommitPrepModuleReadme`**

```ts
export function getDefaultCommitPrepModuleReadme(): string {
  return [
    '# Commit Prep Module',
    '',
    'Provides the `commit-prep` skill to Codex and Claude.',
    '',
    'Rules live in `.ken_spec/rules/process.md` — edit that file to tune commit/branch/PR expectations. The skill reads it at runtime, so changes take effect without `ken-spec sync`.',
    '',
  ].join('\n');
}
```

- [ ] **Step 6: Append `getDefaultCommitPrepSkill`**

```ts
export function getDefaultCommitPrepSkill(): string {
  return [
    '# Commit Preparation Skill',
    '',
    'Use this when the user asks to prepare a commit, branch name, or PR.',
    '',
    '## How',
    '',
    '1. Read `.ken_spec/rules/process.md` — that file is the source of truth.',
    '2. Walk the checklist: commit message format, branch naming, required tests, PR requirements.',
    '3. Report blockers; stop and ask before committing if anything is unclear.',
    '4. Never skip git hooks or bypass checks unless the user explicitly confirms.',
    '',
    'If `rules/process.md` is missing or a section is empty, pause and ask.',
    '',
  ].join('\n');
}
```

- [ ] **Step 7: Build and confirm compile**

Run: `npm run build`
Expected: exits 0 with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/templates.ts
git commit -m "feat: add template helpers for code-style and process rules"
```

---

### Task 2: Update the init test to assert the six new scaffolded paths

**Files:**
- Modify: `test/init-command.test.ts:13-29`

- [ ] **Step 1: Extend `expectedPaths`**

Replace the `expectedPaths` array in `test/init-command.test.ts` with the version below (additions at the bottom):

```ts
    const expectedPaths = [
      '.ken_spec/README.md',
      '.ken_spec/config.yaml',
      '.ken_spec/rules/global.md',
      '.ken_spec/rules/code-style.md',
      '.ken_spec/rules/process.md',
      '.ken_spec/skills/project.md',
      '.ken_spec/commands/start.md',
      '.ken_spec/modules/postmortem/README.md',
      '.ken_spec/modules/postmortem/rules.md',
      '.ken_spec/modules/postmortem/skill.md',
      '.ken_spec/modules/postmortem/templates/case.md',
      '.ken_spec/modules/postmortem/templates/retrospective.md',
      '.ken_spec/modules/postmortem/templates/index.md',
      '.ken_spec/modules/style-review/README.md',
      '.ken_spec/modules/style-review/skill.md',
      '.ken_spec/modules/commit-prep/README.md',
      '.ken_spec/modules/commit-prep/skill.md',
      '.ken_spec/data/postmortem/cases/.gitkeep',
      '.ken_spec/data/postmortem/retrospectives/.gitkeep',
      '.ken_spec/data/postmortem/derived-skills/.gitkeep',
      '.ken_spec/data/postmortem/index.md',
    ];
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npm test -- --run test/init-command.test.ts`
Expected: FAIL — the six new paths under `.ken_spec/rules/`, `.ken_spec/modules/style-review/`, and `.ken_spec/modules/commit-prep/` do not yet exist after `initProject`.

---

### Task 3: Wire the new scaffolded files into `initProject`

**Files:**
- Modify: `src/commands/init.ts`

- [ ] **Step 1: Add imports**

At the top of `src/commands/init.ts`, extend the named imports from `../templates.js` so they include the new helpers (keep the list alphabetized to match existing style):

```ts
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
```

- [ ] **Step 2: Add directory ensures for the two new modules**

In the first `await Promise.all([...])` block, add two new `ensureDir` calls so it reads:

```ts
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
```

- [ ] **Step 3: Add the six new `writeFileIfMissing` calls**

In the second `await Promise.all([...])` block, add the six new entries. After the `rules/global.md` line, add:

```ts
    writeFileIfMissing(path.join(root, 'rules', 'code-style.md'), getDefaultCodeStyleRule()),
    writeFileIfMissing(path.join(root, 'rules', 'process.md'), getDefaultProcessRule()),
```

After the postmortem module block (the three `modules/postmortem/…` writes and the three `modules/postmortem/templates/…` writes), add:

```ts
    writeFileIfMissing(path.join(root, 'modules', 'style-review', 'README.md'), getDefaultStyleReviewModuleReadme()),
    writeFileIfMissing(path.join(root, 'modules', 'style-review', 'skill.md'), getDefaultStyleReviewSkill()),
    writeFileIfMissing(path.join(root, 'modules', 'commit-prep', 'README.md'), getDefaultCommitPrepModuleReadme()),
    writeFileIfMissing(path.join(root, 'modules', 'commit-prep', 'skill.md'), getDefaultCommitPrepSkill()),
```

- [ ] **Step 4: Run the init test to verify it passes**

Run: `npm test -- --run test/init-command.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/init.ts test/init-command.test.ts
git commit -m "feat: scaffold code-style/process rules and new modules on init"
```

---

### Task 4: Add a failing test for sync propagation of the new modules and managed block

**Files:**
- Modify: `test/sync-command.test.ts`

- [ ] **Step 1: Extend `skillPaths` and add managed-block body assertions**

Replace the body of the single `it(...)` in `test/sync-command.test.ts` with the version below:

```ts
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
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npm test -- --run test/sync-command.test.ts`
Expected: FAIL — the managed block still emits the old body (no `Mandatory reads`, no `code-style.md` / `process.md` references).

Note: the `.codex/skills/style-review/SKILL.md` / `.codex/skills/commit-prep/SKILL.md` assertions should already pass thanks to Task 3 (since `loadModuleSkills` auto-picks up any `modules/*/skill.md`), but the managed-block assertions will fail until Task 5.

---

### Task 5: Rewrite `renderRootManagedBlock` to match the spec

**Files:**
- Modify: `src/render.ts:31-42`

- [ ] **Step 1: Replace the body of `renderRootManagedBlock`**

Replace lines 31–42 of `src/render.ts` with:

```ts
export function renderRootManagedBlock(): string {
  return renderManagedBlock([
    'This project uses Ken Spec. Rules below are binding for all work in this repo.',
    '',
    '## Mandatory reads',
    '',
    'Before writing or modifying code, read:',
    '- `.ken_spec/rules/code-style.md`',
    '',
    'Before preparing a commit, branch, or PR, read:',
    '- `.ken_spec/rules/process.md`',
    '',
    'General project rules:',
    '- `.ken_spec/rules/global.md`',
    '',
    'If a rule conflicts with the current task, pause and ask the user.',
    '',
    '## Reference',
    '- `.ken_spec/README.md` — project overview',
    '- `.ken_spec/rules/` — full rules directory',
    '- `.ken_spec/modules/` — structured skill modules (postmortem, style-review, commit-prep, …)',
  ].join('\n'));
}
```

- [ ] **Step 2: Run the sync test to verify it passes**

Run: `npm test -- --run test/sync-command.test.ts`
Expected: PASS.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: all existing tests still pass. Note: `test/doctor-command.test.ts` has an "after init + sync, reports no errors or warnings" case that reads the managed block via `doctor`; the rewrite does not add new doctor findings (yet), so it should still pass.

- [ ] **Step 4: Commit**

```bash
git add src/render.ts test/sync-command.test.ts
git commit -m "feat: rewrite managed block with mandatory reads and rule pointers"
```

---

### Task 6: Guard clean behavior for the two new modules

**Files:**
- Modify: `test/clean-command.test.ts:22-43`

- [ ] **Step 1: Add the new modules to the `targets` array**

In the first `it(...)` of `test/clean-command.test.ts`, replace the `targets` array so it also covers `style-review` and `commit-prep`:

```ts
    const targets = [
      '.codex/skills/project/SKILL.md',
      '.codex/skills/postmortem/SKILL.md',
      '.codex/skills/style-review/SKILL.md',
      '.codex/skills/commit-prep/SKILL.md',
      '.claude/skills/project/SKILL.md',
      '.claude/skills/postmortem/SKILL.md',
      '.claude/skills/style-review/SKILL.md',
      '.claude/skills/commit-prep/SKILL.md',
    ];
```

The rest of the test block (`for (const rel of targets)` loops, the `.codex/skills` / `.claude/skills` parent-dir assertions, AGENTS.md / CLAUDE.md deletion checks, and source-of-truth preservation) stays unchanged.

- [ ] **Step 2: Run the clean test to verify it passes**

Run: `npm test -- --run test/clean-command.test.ts`
Expected: PASS. `loadSkills()` (used by `planClean`) auto-discovers modules under `.ken_spec/modules/`, so no code change is required.

- [ ] **Step 3: Commit**

```bash
git add test/clean-command.test.ts
git commit -m "test: cover clean for style-review and commit-prep modules"
```

---

### Task 7: Add failing doctor test — missing rules file warning

**Files:**
- Modify: `test/doctor-command.test.ts`

- [ ] **Step 1: Append a new test case**

After the existing `it('flags invalid YAML in config.yaml as an error', …)` case and before the closing `});` of the `describe` block, add:

```ts
  it('warns when a rules file is missing', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-missing-rules');
    await initProject(projectRoot);

    await fs.rm(path.join(projectRoot, '.ken_spec', 'rules', 'code-style.md'));

    const report = await runDoctor(projectRoot);
    const warnings = report.findings.filter((f) => f.severity === 'warn');
    expect(warnings.some((f) => f.message.includes('code-style.md'))).toBe(true);
  });
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npm test -- --run test/doctor-command.test.ts -t "warns when a rules file is missing"`
Expected: FAIL — `doctor` does not yet emit a warning for a missing `rules/code-style.md`.

---

### Task 8: Implement the missing-rules-file doctor check

**Files:**
- Modify: `src/commands/doctor.ts`

- [ ] **Step 1: Add a new check block after the postmortem section**

In `src/commands/doctor.ts`, just before the final `return finalize(findings);`, append:

```ts
  // Team-conventions rules files (code-style.md, process.md).
  const conventionRules: Array<{ file: string; sections: string[] }> = [
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
  }
```

(The `continue` is intentional — it leaves room for the empty-section check added in Task 10.)

- [ ] **Step 2: Run the targeted test to verify it passes**

Run: `npm test -- --run test/doctor-command.test.ts -t "warns when a rules file is missing"`
Expected: PASS.

- [ ] **Step 3: Run the full doctor suite**

Run: `npm test -- --run test/doctor-command.test.ts`
Expected: all five existing cases still pass, plus the new one.

- [ ] **Step 4: Commit**

```bash
git add src/commands/doctor.ts test/doctor-command.test.ts
git commit -m "feat(doctor): warn when team-conventions rules files are missing"
```

---

### Task 9: Add failing doctor test — empty rules section emits info findings

**Files:**
- Modify: `test/doctor-command.test.ts`

- [ ] **Step 1: Append another test case**

Append inside the same `describe` block:

```ts
  it('emits info findings when a rules section header is missing', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-empty-rules');
    await initProject(projectRoot);

    await fs.writeFile(
      path.join(projectRoot, '.ken_spec', 'rules', 'code-style.md'),
      '# Code Style Rules\n\n(empty)\n',
      'utf8'
    );

    const report = await runDoctor(projectRoot);
    const infos = report.findings.filter((f) => f.severity === 'info');
    expect(infos.some((f) => f.message.includes('code-style.md') && f.message.includes('Naming'))).toBe(true);
    expect(infos.some((f) => f.message.includes('code-style.md') && f.message.includes('Errors'))).toBe(true);
  });
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npm test -- --run test/doctor-command.test.ts -t "emits info findings when a rules section header is missing"`
Expected: FAIL — `doctor` does not yet check per-section headers in the convention rules files.

---

### Task 10: Implement the rules-section skeleton doctor check

**Files:**
- Modify: `src/commands/doctor.ts`

- [ ] **Step 1: Extend the convention-rules loop added in Task 8**

Replace the `for (const rule of conventionRules) { … }` block from Task 8 with the fuller version:

```ts
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
```

- [ ] **Step 2: Run the targeted test to verify it passes**

Run: `npm test -- --run test/doctor-command.test.ts -t "emits info findings when a rules section header is missing"`
Expected: PASS.

- [ ] **Step 3: Run the full doctor suite**

Run: `npm test -- --run test/doctor-command.test.ts`
Expected: all prior cases still pass. Specifically the "after init + sync, reports no errors or warnings" case must still pass — the freshly-scaffolded files include every expected section header, so no info findings are produced in the clean path.

- [ ] **Step 4: Commit**

```bash
git add src/commands/doctor.ts test/doctor-command.test.ts
git commit -m "feat(doctor): report empty sections in code-style/process rules"
```

---

### Task 11: Add failing doctor test — managed block drift warning

**Files:**
- Modify: `test/doctor-command.test.ts`

- [ ] **Step 1: Append a drift test case**

Append inside the same `describe` block:

```ts
  it('warns when the managed block in AGENTS.md is stale vs renderRootManagedBlock()', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-block-drift');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    const agentsPath = path.join(projectRoot, 'AGENTS.md');
    await fs.writeFile(
      agentsPath,
      '<!-- KEN_SPEC:START -->\nstale hand-edited body\n<!-- KEN_SPEC:END -->\n',
      'utf8'
    );

    const report = await runDoctor(projectRoot);
    const warnings = report.findings.filter((f) => f.severity === 'warn');
    expect(
      warnings.some((f) => f.message.includes('managed block') && f.message.includes('AGENTS.md'))
    ).toBe(true);
  });
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npm test -- --run test/doctor-command.test.ts -t "warns when the managed block in AGENTS.md is stale"`
Expected: FAIL — `doctor` currently only checks whether the `START_MARKER` is present, not whether the body matches.

---

### Task 12: Implement the managed-block-drift doctor check

**Files:**
- Modify: `src/commands/doctor.ts`

- [ ] **Step 1: Import `END_MARKER` and `renderRootManagedBlock`**

Update the existing imports at the top of `src/commands/doctor.ts`:

```ts
import { END_MARKER, START_MARKER } from '../markers.js';
import { loadSkills, renderRootManagedBlock, renderSkillFile } from '../render.js';
```

- [ ] **Step 2: Extend the root-MD-file loop to compare the block body**

Replace the existing `for (const check of rootChecks)` block (the one that currently only checks `START_MARKER` presence) with:

```ts
  const expectedBlock = renderRootManagedBlock();
  for (const check of rootChecks) {
    if (!check.enabled) continue;
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
```

- [ ] **Step 3: Add the `extractManagedBlock` helper**

Add this helper at the bottom of `src/commands/doctor.ts`, next to the existing `normalize` and `exists` helpers:

```ts
function extractManagedBlock(content: string): string | undefined {
  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return undefined;
  }
  return content.slice(startIndex, endIndex + END_MARKER.length);
}
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `npm test -- --run test/doctor-command.test.ts -t "warns when the managed block in AGENTS.md is stale"`
Expected: PASS.

- [ ] **Step 5: Run the full doctor suite**

Run: `npm test -- --run test/doctor-command.test.ts`
Expected: every case passes. In particular the "after init + sync, reports no errors or warnings" case must still pass — after a fresh `sync`, `extractManagedBlock(content)` equals `renderRootManagedBlock()`, so no drift warning fires.

- [ ] **Step 6: Commit**

```bash
git add src/commands/doctor.ts test/doctor-command.test.ts
git commit -m "feat(doctor): detect managed-block drift in AGENTS.md/CLAUDE.md"
```

---

### Task 13: Final full-suite verification

**Files:**
- (none — verification only)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: exits 0 with no TypeScript errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: every test passes across `test/init-command.test.ts`, `test/sync-command.test.ts`, `test/clean-command.test.ts`, `test/doctor-command.test.ts`, `test/markers.test.ts`, and `test/smoke.test.ts`.

- [ ] **Step 3: Smoke-test the CLI end-to-end against a scratch project**

```bash
mkdir -p /tmp/ken-spec-e2e && cd /tmp/ken-spec-e2e && rm -rf .ken_spec .codex .claude AGENTS.md CLAUDE.md
node /Users/wenbokang/projects/ken-spec/dist/bin.js init
node /Users/wenbokang/projects/ken-spec/dist/bin.js sync
node /Users/wenbokang/projects/ken-spec/dist/bin.js doctor
```

Expected output contains, in order:
- A populated `.ken_spec/rules/code-style.md` and `.ken_spec/rules/process.md`.
- `.codex/skills/style-review/SKILL.md` and `.codex/skills/commit-prep/SKILL.md` (and the Claude equivalents) exist.
- `AGENTS.md` contains the `Mandatory reads` section with references to `code-style.md` and `process.md`.
- `doctor` reports `0 error(s), 0 warning(s), 0 info`.

- [ ] **Step 4: Confirm the branch is ready**

Run: `git status`
Expected: working tree clean; `git log --oneline` shows the six commits from Tasks 1, 3, 5, 6, 8, 10, 12.
