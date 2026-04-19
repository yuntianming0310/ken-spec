# Postmortem Module Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate `postmortem` into `.elfe_spec` as the first built-in module, with project-local templates, data directories, and synced Codex/Claude skill output.

**Architecture:** Extend `init` so new projects get a `modules/postmortem/` definition and `data/postmortem/` storage tree inside `.elfe_spec`. Extend `sync` so it loads both top-level skills and module-provided `skill.md` files, rendering them into Codex and Claude skill directories while preserving the current managed root-file injection behavior.

**Tech Stack:** Node.js, TypeScript, Commander, YAML, Vitest

---

### Task 1: Add failing tests for postmortem module scaffolding

**Files:**
- Modify: `test/init-command.test.ts`

- [ ] **Step 1: Add assertions for module and data paths**

```ts
const expectedPaths = [
  '.elfe_spec/modules/postmortem/README.md',
  '.elfe_spec/modules/postmortem/skill.md',
  '.elfe_spec/modules/postmortem/templates/case.md',
  '.elfe_spec/modules/postmortem/templates/retrospective.md',
  '.elfe_spec/modules/postmortem/templates/index.md',
  '.elfe_spec/data/postmortem/cases/.gitkeep',
  '.elfe_spec/data/postmortem/retrospectives/.gitkeep',
  '.elfe_spec/data/postmortem/derived-skills/.gitkeep',
  '.elfe_spec/data/postmortem/index.md',
];
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npm test -- --run test/init-command.test.ts`
Expected: FAIL because the postmortem module scaffold does not exist yet

### Task 2: Add failing tests for syncing module-provided skills

**Files:**
- Modify: `test/sync-command.test.ts`

- [ ] **Step 1: Assert postmortem skill output exists for both tools**

```ts
const skillPaths = [
  '.codex/skills/project/SKILL.md',
  '.codex/skills/postmortem/SKILL.md',
  '.claude/skills/project/SKILL.md',
  '.claude/skills/postmortem/SKILL.md',
];
```

- [ ] **Step 2: Assert synced postmortem content references project-local storage**

```ts
const codexPostmortem = await readFile(path.join(projectRoot, '.codex/skills/postmortem/SKILL.md'));
expect(codexPostmortem).toContain('.elfe_spec/data/postmortem/');
```

- [ ] **Step 3: Run the targeted test to verify it fails**

Run: `npm test -- --run test/sync-command.test.ts`
Expected: FAIL because sync only reads `.elfe_spec/skills/*.md`

### Task 3: Implement module scaffolding and sync support

**Files:**
- Modify: `src/commands/init.ts`
- Modify: `src/render.ts`
- Modify: `src/templates.ts`

- [ ] **Step 1: Add postmortem module template helpers**

```ts
export function getDefaultPostmortemModuleSkill(): string {
  return [
    '---',
    'name: postmortem',
    'description: ...',
    '---',
    '',
    '# Retrospective Capture Skill',
  ].join('\n');
}
```

- [ ] **Step 2: Extend init to create module and data directories**

```ts
await Promise.all([
  ensureDir(path.join(root, 'modules', 'postmortem', 'templates')),
  ensureDir(path.join(root, 'data', 'postmortem', 'cases')),
  ensureDir(path.join(root, 'data', 'postmortem', 'retrospectives')),
  ensureDir(path.join(root, 'data', 'postmortem', 'derived-skills')),
]);
```

- [ ] **Step 3: Extend sync skill loading to include module skill files**

```ts
export async function loadSkills(projectRoot: string): Promise<SkillSource[]> {
  const topLevelSkills = await loadMarkdownFiles(path.join(projectRoot, '.elfe_spec', 'skills'));
  const moduleSkills = await loadModuleSkills(path.join(projectRoot, '.elfe_spec', 'modules'));
  return [...topLevelSkills, ...moduleSkills];
}
```

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `npm test -- --run test/init-command.test.ts`
Expected: PASS

Run: `npm test -- --run test/sync-command.test.ts`
Expected: PASS

### Task 4: Re-run the full suite and update docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document postmortem as a built-in module**

```md
- `modules/postmortem/`: built-in self-improvement module definition
- `data/postmortem/`: project-local postmortem knowledge base
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS with all tests green

- [ ] **Step 3: Rebuild the project**

Run: `npm run build`
Expected: PASS with updated `dist/`
