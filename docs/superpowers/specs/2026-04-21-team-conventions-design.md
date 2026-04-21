# Team Conventions Design

**Date:** 2026-04-21
**Status:** Approved, ready for implementation planning

## Goal

Give ken-spec a first-class way to capture team code-style and process conventions that are shared via git and applied by AI agents. Two usage modes must work together:

- **Always-on guardrails (A)** — rules agents must respect throughout every task (e.g., naming conventions, commit-message format). Delivered via the `AGENTS.md` / `CLAUDE.md` managed block so they load at session start.
- **On-demand skills (B)** — actions agents take when asked (e.g., "review this file's style", "prepare a commit"). Delivered via `modules/*/skill.md` that consume the same rule files.

## Non-Goals

- Building an opinionated style guide. Default scaffolds are empty shells with example bullets; teams fill them in.
- Supporting additional AI tools beyond the current Codex/Claude targets.
- Enforcement/linting. Agents interpret the rules; ken-spec only distributes them.

## Architecture

### Data Model

```
.ken_spec/
├── rules/                         Source of truth for all rule files
│   ├── global.md                  (existing) generic project rules
│   ├── code-style.md              (NEW) passive code-style rules
│   └── process.md                 (NEW) passive process/commit rules
└── modules/
    ├── postmortem/                (existing)
    ├── style-review/              (NEW) on-demand skill reading rules/code-style.md
    │   ├── README.md
    │   └── skill.md
    └── commit-prep/               (NEW) on-demand skill reading rules/process.md
        ├── README.md
        └── skill.md
```

Rules have exactly **one source** (`rules/*.md`). They are consumed in two places:

1. The root managed block (always-on delivery to agents at session start).
2. Module `skill.md` files (on-demand delivery via Codex/Claude skill lookup).

### Key Design Decisions

- **Rules and actions are separate concepts.** `rules/` holds reference content that humans edit; `modules/` holds skills that perform actions using those rules. This keeps postmortem-style modules and code-style rules from being forced into the same shape.
- **Module names are action verbs.** `style-review` and `commit-prep` reflect "what the agent does", not "what the rules are called". This avoids collision with `rules/code-style.md` and makes the skill's trigger obvious.
- **Default scaffolds are deliberately empty.** Each section header is present, but bullets are one-line examples or HTML-commented hints. ken-spec must not dictate `camelCase` vs `snake_case`.
- **Static references in the managed block.** The block hardcodes `rules/code-style.md` and `rules/process.md`. If a user deletes one, the reference becomes stale; `doctor` catches this instead of the renderer branching dynamically.

## Scaffolding Content

### `rules/code-style.md`

Fixed sections with short example bullets and HTML comments hinting at what goes in each:

- `## Naming`
- `## Formatting`
- `## Type safety`
- `## Comments`
- `## Imports`
- `## Errors`

Header text: "Edit this file to define code-style rules for this project. Agents read it before writing or modifying code."

### `rules/process.md`

Fixed sections:

- `## Commit messages`
- `## Branches`
- `## Pull requests & code review`
- `## Testing requirements`
- `## Release`

Header text: "Edit this file to define process rules for this project. Agents read it before preparing a commit, branch, or PR."

### Managed Block (new content)

Returned by `renderRootManagedBlock()`:

```markdown
<!-- KEN_SPEC:START -->
This project uses Ken Spec. Rules below are binding for all work in this repo.

## Mandatory reads

Before writing or modifying code, read:
- `.ken_spec/rules/code-style.md`

Before preparing a commit, branch, or PR, read:
- `.ken_spec/rules/process.md`

General project rules:
- `.ken_spec/rules/global.md`

If a rule conflicts with the current task, pause and ask the user.

## Reference
- `.ken_spec/README.md` — project overview
- `.ken_spec/rules/` — full rules directory
- `.ken_spec/modules/` — structured skill modules (postmortem, style-review, commit-prep, …)
<!-- KEN_SPEC:END -->
```

Tone upgrade vs. the previous block: "binding", "Mandatory reads", explicit trigger verbs ("Before writing…", "Before preparing…"). A safety valve ("pause and ask") is kept to avoid agents applying rules rigidly when a task legitimately conflicts.

### `modules/style-review/skill.md`

```markdown
# Code Style Review Skill

Use this when the user asks to review code for style, consistency, or pre-commit cleanup.

## How

1. Read `.ken_spec/rules/code-style.md` — that file is the source of truth.
2. For each file in scope, walk through the rule sections (Naming, Formatting, Type safety, Comments, Imports, Errors).
3. Report violations with `file:line` pointers and suggested fixes.
4. Don't auto-fix unless the user asks.

If `rules/code-style.md` is missing or a section is empty, pause and ask.
```

### `modules/commit-prep/skill.md`

```markdown
# Commit Preparation Skill

Use this when the user asks to prepare a commit, branch name, or PR.

## How

1. Read `.ken_spec/rules/process.md` — that file is the source of truth.
2. Walk the checklist: commit message format, branch naming, required tests, PR requirements.
3. Report blockers; stop and ask before committing if anything is unclear.
4. Never skip git hooks or bypass checks unless the user explicitly confirms.

If `rules/process.md` is missing or a section is empty, pause and ask.
```

### Module READMEs

Short pointers directing users to the rules file they should edit:

**`modules/style-review/README.md`**

```markdown
# Style Review Module

Provides the `style-review` skill to Codex and Claude.

Rules live in `.ken_spec/rules/code-style.md` — edit that file to tune what counts as a violation. The skill reads it at runtime, so changes take effect without `ken-spec sync`.
```

**`modules/commit-prep/README.md`**: identical shape, pointing at `rules/process.md`.

## Changes by File

| File | Change |
|------|--------|
| `src/templates.ts` | Add `getDefaultCodeStyleRule`, `getDefaultProcessRule`, `getDefaultStyleReviewModuleReadme`, `getDefaultStyleReviewSkill`, `getDefaultCommitPrepModuleReadme`, `getDefaultCommitPrepSkill` |
| `src/commands/init.ts` | `writeFileIfMissing` for each of the six new files |
| `src/render.ts` | Rewrite `renderRootManagedBlock()` body to the new text above. The function is already exported; `doctor` imports it to compute the expected block for drift comparison. |
| `src/commands/doctor.ts` | Three new checks (see below) |
| `test/init-command.test.ts` | Assert new paths exist after init |
| `test/sync-command.test.ts` | Assert SKILL.md for `style-review` and `commit-prep` appears in `.codex/skills/` and `.claude/skills/`; assert managed block contains `code-style.md` and `process.md` |
| `test/doctor-command.test.ts` | Three new cases (missing rules file, stale managed block, empty rules section) |
| `test/clean-command.test.ts` | Assert the new modules' SKILL.md are cleaned |

No changes required in `src/commands/sync.ts`, `src/commands/clean.ts`, or `src/markers.ts`. The new modules are picked up automatically by `loadModuleSkills()` and handled transparently by `syncProject` and `cleanProject`.

## `doctor` New Checks

1. **Missing rules file** (warn): If `rules/code-style.md` or `rules/process.md` is missing, emit a warning recommending the user restore it or run `ken-spec init` in an empty subdir to regenerate.
2. **Rules section skeleton missing** (info): Each expected section header absent from `code-style.md` / `process.md` emits a per-section info finding (same pattern as the existing postmortem `rules.md` check).
3. **Managed block drift** (warn): Extract the current `<!-- KEN_SPEC:START -->…END -->` block from `AGENTS.md` / `CLAUDE.md` and compare it (normalized) to `renderRootManagedBlock()`'s current output. Mismatch → warn "managed block stale — run `ken-spec sync`".
   - Normalization: strip CRLF, trim.
   - This covers both ken-spec upgrades (stale output) and hand-edits to the block.

## Testing Plan

1. **init scaffolding** — `test/init-command.test.ts` extends `expectedPaths` with the six new files.
2. **sync propagation** — `test/sync-command.test.ts`:
   - Assert `.codex/skills/style-review/SKILL.md` and `.codex/skills/commit-prep/SKILL.md` exist.
   - Assert `.claude/skills/style-review/SKILL.md` and `.claude/skills/commit-prep/SKILL.md` exist.
   - Assert `AGENTS.md` content contains `code-style.md` and `process.md` and `Mandatory reads`.
3. **doctor new checks** — `test/doctor-command.test.ts`:
   - After init, delete `rules/code-style.md` → doctor emits a warning mentioning `code-style.md`.
   - After init + sync, overwrite `AGENTS.md` managed block with stale text → doctor emits "managed block stale" warning.
   - After init, wipe `rules/code-style.md` to an empty file → doctor emits info findings per missing section.
4. **clean regression** — `test/clean-command.test.ts`: after clean, `.codex/skills/style-review/` and `.claude/skills/commit-prep/` no longer exist.

## Rollout

This is an additive change. Existing projects will keep working until they rerun `ken-spec init` (which only writes missing files — no overwrites) or `ken-spec sync` (which refreshes the managed block). There is no migration. Users who want the new rules files can either:

- Re-run `ken-spec init` in their project (safe — `writeFileIfMissing` won't clobber existing files), **then** `ken-spec sync`.
- Or manually create the rules files and run `ken-spec sync`.

`doctor` will surface the "managed block stale" warning for any project that upgrades ken-spec but hasn't re-synced, making the upgrade path self-documenting.

## Open Questions

None at spec approval time.
