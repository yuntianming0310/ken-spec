# Elfe Spec Minimal CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Node.js CLI that initializes a `.elfe_spec` source-of-truth directory and syncs its contents into Codex/Claude skill folders plus managed blocks in `AGENTS.md` and `CLAUDE.md`.

**Architecture:** Use a small TypeScript CLI with two commands: `init` scaffolds `.elfe_spec`, and `sync` reads `.elfe_spec/config.yaml`, renders skills into `.codex/skills` and `.claude/skills`, and updates managed marker blocks in root markdown files. Shared modules handle config loading, managed-block replacement, filesystem helpers, and skill rendering so the command layer stays thin.

**Tech Stack:** Node.js, TypeScript, Commander, YAML, Vitest

---

### Task 1: Scaffold the package and TypeScript toolchain

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/cli.ts`
- Create: `src/index.ts`
- Create: `test/smoke.test.ts`

- [ ] **Step 1: Create the package manifest with CLI entrypoints and scripts**

```json
{
  "name": "elfe-spec",
  "version": "0.1.0",
  "description": "Minimal personal AI spec sync tool for Codex and Claude",
  "type": "module",
  "bin": {
    "elfe-spec": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "engines": {
    "node": ">=20.19.0"
  },
  "dependencies": {
    "commander": "^14.0.0",
    "yaml": "^2.8.2"
  },
  "devDependencies": {
    "@types/node": "^24.2.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Add TypeScript and Vitest configuration**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*.ts"]
}
```

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add a minimal CLI smoke test**

```ts
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('runs tests', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests to verify the scaffold passes**

Run: `npm test`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore src/cli.ts src/index.ts test/smoke.test.ts
git commit -m "chore: scaffold elfe-spec cli"
```

### Task 2: Implement `.elfe_spec` initialization

**Files:**
- Modify: `src/cli.ts`
- Create: `src/commands/init.ts`
- Create: `src/fs.ts`
- Create: `src/templates.ts`
- Create: `test/init-command.test.ts`

- [ ] **Step 1: Write the failing init command test**

```ts
it('creates the default .elfe_spec structure', async () => {
  // create temp project dir
  // run init command
  // assert .elfe_spec/README.md, config.yaml, rules/global.md, skills/project.md, commands/start.md exist
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- init-command`
Expected: FAIL because `init` and template writers do not exist yet

- [ ] **Step 3: Implement the default template and directory writer**

```ts
export async function initProject(projectRoot: string): Promise<void> {
  // mkdir .elfe_spec and child folders
  // write default README/config/rules/skills/commands if missing
}
```

- [ ] **Step 4: Wire the `init` command into Commander**

```ts
program
  .command('init')
  .description('Initialize .elfe_spec in the current project')
  .action(async () => {
    await initProject(process.cwd());
  });
```

- [ ] **Step 5: Run tests to verify init passes**

Run: `npm test -- init-command`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts src/commands/init.ts src/fs.ts src/templates.ts test/init-command.test.ts
git commit -m "feat: add elfe-spec init command"
```

### Task 3: Implement config loading and managed block replacement

**Files:**
- Create: `src/config.ts`
- Create: `src/markers.ts`
- Create: `test/markers.test.ts`

- [ ] **Step 1: Write failing managed-block tests**

```ts
it('replaces an existing managed block without touching surrounding content', () => {
  // existing markdown with user content and ELFE_SPEC markers
});

it('appends a managed block when markers are missing', () => {
  // plain markdown -> markdown plus new block
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- markers`
Expected: FAIL because marker utilities do not exist yet

- [ ] **Step 3: Implement config parsing and marker rendering**

```ts
export interface ElfeSpecConfig {
  injectAgentsMd: boolean;
  injectClaudeMd: boolean;
  codex: { enabled: boolean };
  claude: { enabled: boolean };
}

export function updateManagedBlock(content: string, block: string): string {
  // replace ELFE_SPEC:START..END or append it
}
```

- [ ] **Step 4: Run tests to verify marker behavior passes**

Run: `npm test -- markers`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/markers.ts test/markers.test.ts
git commit -m "feat: add config loading and managed block updates"
```

### Task 4: Implement skill rendering and `sync`

**Files:**
- Modify: `src/cli.ts`
- Create: `src/commands/sync.ts`
- Create: `src/render.ts`
- Create: `test/sync-command.test.ts`

- [ ] **Step 1: Write the failing sync integration test**

```ts
it('syncs .elfe_spec content into codex, claude, AGENTS.md, and CLAUDE.md', async () => {
  // seed temp project with .elfe_spec
  // run sync
  // assert .codex/skills/project/SKILL.md exists
  // assert .claude/skills/project/SKILL.md exists
  // assert AGENTS.md and CLAUDE.md contain managed block
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sync-command`
Expected: FAIL because `sync` and renderers do not exist yet

- [ ] **Step 3: Implement skill rendering and sync orchestration**

```ts
export async function syncProject(projectRoot: string): Promise<void> {
  // load config
  // read .elfe_spec/skills/*.md
  // render SKILL.md content
  // write to .codex/skills/<name>/SKILL.md and .claude/skills/<name>/SKILL.md
  // update AGENTS.md and CLAUDE.md managed blocks
}
```

- [ ] **Step 4: Wire the `sync` command into Commander**

```ts
program
  .command('sync')
  .description('Sync .elfe_spec into Codex/Claude entrypoints')
  .action(async () => {
    await syncProject(process.cwd());
  });
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS with all tests green

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts src/commands/sync.ts src/render.ts test/sync-command.test.ts
git commit -m "feat: add elfe-spec sync command"
```

### Task 5: Build and manually verify the CLI

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write a concise README covering install, init, and sync**

```md
# elfe-spec

Minimal personal AI spec sync tool.

## Commands
- `npm run build`
- `node dist/cli.js init`
- `node dist/cli.js sync`
```

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: PASS with `dist/` emitted

- [ ] **Step 3: Manually verify init and sync in a temp project**

Run: `tmpdir=$(mktemp -d) && cd "$tmpdir" && node /Users/wenbokang/projects/elfe-spec/dist/cli.js init && node /Users/wenbokang/projects/elfe-spec/dist/cli.js sync`
Expected: `.elfe_spec`, `.codex/skills/project/SKILL.md`, `.claude/skills/project/SKILL.md`, `AGENTS.md`, and `CLAUDE.md` exist

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add elfe-spec usage guide"
```
