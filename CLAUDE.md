# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ken-spec is a CLI tool that syncs a `.ken_spec/` source-of-truth directory into AI tool entrypoints (`.codex/skills/`, `.claude/skills/`, `AGENTS.md`, `CLAUDE.md`). It manages a `postmortem` module for capturing debugging lessons.

## Commands

- **Build**: `npm run build` (runs `node build.mjs` which invokes `tsc` and chmod's the bin)
- **Test all**: `npm run test` (runs `vitest run`)
- **Test single file**: `npx vitest run test/<name>.test.ts`
- **Run CLI locally**: `node dist/bin.js init` / `node dist/bin.js sync`

No lock file or `npm install` step is checked in — install dependencies before building.

## Architecture

The CLI has two commands (`init` and `sync`) wired via Commander in `src/cli.ts`, with `src/bin.ts` as the executable entrypoint.

Key modules:
- **`src/commands/init.ts`** — scaffolds `.ken_spec/` directory tree with default templates (rules, skills, commands, postmortem module + data dirs). Uses `writeFileIfMissing` so it never overwrites existing content.
- **`src/commands/sync.ts`** — reads config, loads skills from `.ken_spec/skills/*.md` and `.ken_spec/modules/*/skill.md`, then writes them to `.codex/skills/<name>/SKILL.md` and `.claude/skills/<name>/SKILL.md`. Also injects a managed block into `AGENTS.md`/`CLAUDE.md`.
- **`src/config.ts`** — loads `.ken_spec/config.yaml` (YAML format) with toggles for each sync target.
- **`src/markers.ts`** — manages `<!-- KEN_SPEC:START -->` / `<!-- KEN_SPEC:END -->` delimited blocks in markdown files. `updateManagedBlock` replaces or appends the block.
- **`src/render.ts`** — loads skill files and renders them with YAML frontmatter for output. Also produces the root managed block content.
- **`src/fs.ts`** — file utilities: `ensureDir`, `writeFileIfMissing`, `writeText`, `readTextOrEmpty`.
- **`src/templates.ts`** — all default file content as pure functions (config, readme, rules, skills, postmortem templates).

## Build

TypeScript (ES2022, NodeNext module resolution) compiled via `tsc`. The build script (`build.mjs`) cleans `dist/`, runs tsc, and makes `dist/bin.js` executable. Output includes `.d.ts` declarations.

## Tests

Vitest with tests in `test/`. Test helpers (`test/helpers.ts`) provide `makeTempProject` for isolated temp directories. Tests exercise init scaffolding, sync output, marker injection, and basic smoke checks.
