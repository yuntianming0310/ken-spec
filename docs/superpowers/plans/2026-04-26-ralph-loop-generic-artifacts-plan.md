# Ralph Loop Generic Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Ralph Loop from a document-only workflow into a generic artifact refinement workflow with a first-class code adapter.

**Architecture:** Keep the existing static-template architecture: `initProject()` scaffolds `.ken_spec/`, `syncProject()` mirrors module asset directories, and `doctor` validates synced output. The implementation changes the Ralph Loop static assets, adds one new reference file and one code rubric, and strengthens tests so future edits cannot regress it back to document-only behavior.

**Tech Stack:** TypeScript, Node.js `fs/promises`, YAML templates, Vitest.

---

## File Structure

- Modify `src/templates.ts`: update Ralph Loop README, skill, prompts, task-spec template, add `getDefaultRalphLoopArtifactAdapters()` and `getDefaultRalphLoopCodeImplementationRubric()`.
- Modify `src/commands/init.ts`: import and scaffold the two new Ralph Loop asset files.
- Modify `src/commands/doctor.ts`: keep subdir checks and add required-file checks for `references/artifact-adapters.md` and `rubrics/code-implementation.yaml`.
- Modify `test/ralph-loop.test.ts`: add failing tests for new scaffold files, sync mirroring, rubric validity, doctor warnings, and generic skill wording.
- Create no new runtime code paths. `syncProject()` already mirrors whole asset subdirectories.

---

### Task 1: Pin Generic Ralph Loop Behavior In Tests

**Files:**
- Modify: `test/ralph-loop.test.ts`

- [ ] **Step 1: Extend init scaffolding expected paths**

In `describe('initProject — ralph-loop scaffolding')`, add these expected paths to the `expectedPaths` array:

```ts
'.ken_spec/modules/ralph-loop/rubrics/code-implementation.yaml',
'.ken_spec/modules/ralph-loop/references/artifact-adapters.md',
```

- [ ] **Step 2: Add a skill wording test**

Append this test in `describe('initProject — ralph-loop scaffolding')`:

```ts
  it('describes Ralph Loop as a generic artifact workflow with code support', async () => {
    const projectRoot = await makeTempProject('ken-spec-init-ralph-generic-skill');
    await initProject(projectRoot);

    const content = await fs.readFile(
      path.join(projectRoot, '.ken_spec', 'modules', 'ralph-loop', 'skill.md'),
      'utf8'
    );

    expect(content).toContain('generic artifact refinement workflow');
    expect(content).toContain('code implementation');
    expect(content).toContain('refactor');
    expect(content).toContain('design-to-code');
    expect(content).toContain('plan/patch mode');
    expect(content).toContain('direct implementation mode');
    expect(content).not.toContain('Use this skill when the user asks to generate, refine, or improve a long-form structured document');
  });
```

- [ ] **Step 3: Add sync mirroring checks for the new files**

Append this test in `describe('syncProject — ralph-loop asset mirroring')`:

```ts
  it('mirrors generic adapter reference and code rubric files to both tool dirs', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-generic-assets');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    for (const tool of ['.claude', '.codex']) {
      const adapterPath = path.join(
        projectRoot,
        tool,
        'skills',
        'ralph-loop',
        'references',
        'artifact-adapters.md'
      );
      const codeRubricPath = path.join(
        projectRoot,
        tool,
        'skills',
        'ralph-loop',
        'rubrics',
        'code-implementation.yaml'
      );

      await expect(fs.access(adapterPath)).resolves.toBeUndefined();
      await expect(fs.access(codeRubricPath)).resolves.toBeUndefined();
    }
  });
```

- [ ] **Step 4: Add code rubric validation**

Append this test in `describe('built-in rubric YAML validity')`:

```ts
  it('code-implementation.yaml passes all validation rules', async () => {
    const projectRoot = await makeTempProject('ken-spec-rubric-code-implementation');
    await initProject(projectRoot);
    const rubric = await loadRubric(projectRoot, 'code-implementation');
    validateRubric(rubric, 'code-implementation');
  });
```

- [ ] **Step 5: Add doctor required-file warning tests**

Append this test in `describe('runDoctor — ralph-loop asset checks')`:

```ts
  it('warns when a required ralph-loop generic asset file is missing', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-ralph-required-file');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    await fs.rm(
      path.join(
        projectRoot,
        '.claude',
        'skills',
        'ralph-loop',
        'references',
        'artifact-adapters.md'
      )
    );

    const report = await runDoctor(projectRoot);
    const warnings = report.findings.filter((f) => f.severity === 'warn');
    expect(
      warnings.some(
        (f) => f.message.includes('ralph-loop') && f.message.includes('artifact-adapters.md')
      )
    ).toBe(true);
  });
```

- [ ] **Step 6: Run the focused test and verify failure**

Run:

```bash
npm test -- test/ralph-loop.test.ts
```

Expected: FAIL because the new files and generic wording do not exist yet.

---

### Task 2: Implement Generic Ralph Loop Templates

**Files:**
- Modify: `src/templates.ts`
- Modify: `src/commands/init.ts`

- [ ] **Step 1: Add template helper exports**

In `src/templates.ts`, add these functions near the existing Ralph Loop template helpers:

```ts
export function getDefaultRalphLoopArtifactAdapters(): string {
  return [
    '# Ralph Loop — Artifact Adapters',
    '',
    'Ralph Loop is a generic artifact refinement workflow. Adapters define artifact-specific defaults while sharing the same Orchestrator, Planner, Generator, Evaluator, and Assembler loop.',
    '',
    '## Adapter selection',
    '',
    '| Adapter | Use when | Default output | Default rubric |',
    '|---|---|---|---|',
    '| `document` | one-pagers, PRDs, RFCs, briefs, long-form docs | Markdown document | `rubrics/one-pager.yaml` or a user-selected document rubric |',
    '| `code` | code implementation, refactor, design-to-code, implementation planning | implementation plan plus patch proposal; direct edits only with explicit permission | `rubrics/code-implementation.yaml` |',
    '| `decision` | architecture decisions, technical choices, tradeoff analysis | decision memo or recommendation | user-provided rubric in v1 |',
    '',
    'If the task is not clearly a document, do not reject it. Classify it, choose the closest adapter, or ask the user for a rubric when no default exists.',
    '',
    '## Code execution modes',
    '',
    '### plan/patch mode',
    '',
    'Default for code tasks. The loop refines an implementation plan, affected-file list, patch proposal or diff guidance, test strategy, risk notes, and blockers. The main agent applies the final plan and runs verification.',
    '',
    '### direct implementation mode',
    '',
    'Allowed only when the user explicitly permits Ralph Loop subagents to edit code. Each worker must own a disjoint file or module scope, must not revert unrelated changes, and must adapt to other in-progress edits. The Orchestrator integrates, resolves conflicts, and runs verification.',
    '',
  ].join('\\n');
}
```

Also add:

```ts
export function getDefaultRalphLoopCodeImplementationRubric(): string {
  return [
    'name: code-implementation',
    'version: 1',
    'description: "Code implementation and refactor scoring"',
    'threshold: 82',
    'max_rounds: 4',
    'early_stop:',
    '  no_improve_rounds: 2',
    '',
    'criteria:',
    '  - id: correctness',
    '    weight: 0.30',
    '    rubric: |',
    '      Evaluate whether the proposed implementation satisfies the requested behavior and handles important edge cases.',
    '      90-100: behavior is fully covered, edge cases are identified, and no requirement is missed',
    '      75-89: core behavior is covered with minor edge-case gaps',
    '      60-74: partial behavior coverage or unclear handling of important paths',
    '      40-59: major requirement gaps or likely incorrect behavior',
    '      0-39: solution does not address the requested behavior',
    '    evaluator: strict_engineer',
    '  - id: integration_fit',
    '    weight: 0.20',
    '    rubric: |',
    '      Evaluate fit with the existing architecture, APIs, conventions, and data flow.',
    '      90-100: uses established patterns and integrates cleanly with minimal surface area',
    '      75-89: mostly consistent with small integration or naming issues',
    '      60-74: works in concept but bends local patterns or leaves API seams unclear',
    '      40-59: conflicts with architecture or introduces avoidable coupling',
    '      0-39: ignores the existing system design',
    '    evaluator: integration_reviewer',
    '  - id: test_strategy',
    '    weight: 0.20',
    '    rubric: |',
    '      Evaluate whether tests or verification steps cover the riskiest behavior.',
    '      90-100: focused tests cover success, failure, and edge paths with clear commands',
    '      75-89: useful tests cover the main behavior with minor gaps',
    '      60-74: verification is plausible but underspecified or too narrow',
    '      40-59: tests are weak, vague, or disconnected from risk',
    '      0-39: no meaningful verification strategy',
    '    evaluator: test_reviewer',
    '  - id: maintainability',
    '    weight: 0.15',
    '    rubric: |',
    '      Evaluate readability, scope control, and future maintainability.',
    '      90-100: simple, readable, well-scoped, and avoids needless abstraction',
    '      75-89: maintainable with small naming or structure improvements available',
    '      60-74: understandable but more complex than needed',
    '      40-59: difficult to maintain or spreads logic across poor boundaries',
    '      0-39: brittle, confusing, or over-engineered',
    '    evaluator: strict_engineer',
    '  - id: safety_risk',
    '    weight: 0.15',
    '    rubric: |',
    '      Evaluate whether migration, compatibility, concurrency, data-loss, rollback, and operational risks are identified.',
    '      90-100: material risks are identified with concrete mitigations or rollback notes',
    '      75-89: most risks are covered with minor omissions',
    '      60-74: some risks are mentioned but mitigations are shallow',
    '      40-59: important risks are missed',
    '      0-39: risk is ignored or misrepresented',
    '    evaluator: risk_reviewer',
    '',
    'personas:',
    '  strict_engineer:',
    '    prompt: "You are a strict senior engineer. You evaluate behavior, edge cases, simplicity, and maintainability. Penalize vague plans and unnecessary abstraction."',
    '    temperature: 0',
    '  integration_reviewer:',
    '    prompt: "You are an integration reviewer. You focus only on fit with the existing codebase, APIs, ownership boundaries, and conventions."',
    '    temperature: 0',
    '  test_reviewer:',
    '    prompt: "You are a test reviewer. You focus only on whether the verification strategy covers the riskiest behavior with concrete commands or test cases."',
    '    temperature: 0',
    '  risk_reviewer:',
    '    prompt: "You are a risk reviewer. You focus only on compatibility, migration, concurrency, data-loss, rollback, and operational risk."',
    '    temperature: 0',
    '',
    'aggregation:',
    '  method: weighted_sum',
    '',
  ].join('\\n');
}
```

- [ ] **Step 2: Rewrite Ralph Loop README and skill templates**

Update `getDefaultRalphLoopModuleReadme()` so it says Ralph Loop is a generic artifact refinement workflow and references artifact adapters.

Update `getDefaultRalphLoopSkill()` so:

- Trigger includes documents, code implementation, refactor, design-to-code, and decision/analysis tasks.
- Self-check includes `Task type`, `Selected adapter`, `Execution mode`, `Rubric`, and `Planner`.
- Step 1 says classify the task and select an adapter before collecting inputs.
- Code tasks default to plan/patch mode.
- Direct implementation mode requires explicit user permission.
- Planner role is included before Generator.
- Final output mentions adapter-specific artifacts, not only `best.md` as a document.

- [ ] **Step 3: Rewrite subagent prompts generically**

Update:

- `getDefaultRalphLoopGeneratorPrompt()` to accept `[ADAPTER]`, `[EXECUTION MODE]`, `[PLANNER OUTPUT]`, and output a full artifact candidate. Include code-mode instructions for plan/patch and direct implementation.
- `getDefaultRalphLoopEvaluatorPrompt()` to evaluate an artifact, not only a document.
- `getDefaultRalphLoopAssemblerPrompt()` to merge adapter-specific artifacts and prohibit unverified claims, especially fake test results for code tasks.

- [ ] **Step 4: Update task-spec template**

Update `getDefaultRalphLoopTaskSpecTemplate()` so it captures subject, task type, selected adapter, execution mode, success criteria, constraints, affected files, verification expectations, and context.

- [ ] **Step 5: Wire new files into init**

In `src/commands/init.ts`:

```ts
  getDefaultRalphLoopArtifactAdapters,
  getDefaultRalphLoopCodeImplementationRubric,
```

Add writes:

```ts
writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'rubrics', 'code-implementation.yaml'), getDefaultRalphLoopCodeImplementationRubric()),
writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'references', 'artifact-adapters.md'), getDefaultRalphLoopArtifactAdapters()),
```

- [ ] **Step 6: Run focused test and verify pass**

Run:

```bash
npm test -- test/ralph-loop.test.ts
```

Expected: PASS except the doctor required-file test if Task 3 has not been implemented yet.

---

### Task 3: Add Doctor Required-File Checks And Verify All Tests

**Files:**
- Modify: `src/commands/doctor.ts`

- [ ] **Step 1: Add required Ralph Loop file list**

Near the existing `ralphAssetDirs` check in `src/commands/doctor.ts`, add:

```ts
  const ralphRequiredAssetFiles = [
    path.join('references', 'artifact-adapters.md'),
    path.join('rubrics', 'code-implementation.yaml'),
  ];
```

- [ ] **Step 2: Check each required file in each enabled tool dir**

After the subdir non-empty check, add:

```ts
  for (const target of targets) {
    if (!target.enabled) continue;
    for (const assetFile of ralphRequiredAssetFiles) {
      const filePath = path.join(
        projectRoot,
        target.toolDir,
        'skills',
        'ralph-loop',
        assetFile
      );
      if (!(await exists(filePath))) {
        findings.push({
          severity: 'warn',
          message: `ralph-loop required asset missing in ${target.label}: ${assetFile} — run \`ken-spec sync\``,
        });
      }
    }
  }
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- test/ralph-loop.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS and `dist/` regenerated.

- [ ] **Step 6: Inspect git diff**

Run:

```bash
git diff -- src/templates.ts src/commands/init.ts src/commands/doctor.ts test/ralph-loop.test.ts
git status --short
```

Expected: only intended source, test, plan, spec, and build output changes are present.

---

## Self-Review

- Spec coverage: covered generic trigger, roles, adapters, code adapter modes, code rubric, prompt changes, file layout, compatibility, doctor checks, and tests.
- Placeholder scan: no unfinished-marker phrases or vague implementation steps remain.
- Type consistency: new helper names are consistent between `src/templates.ts` and `src/commands/init.ts`.
