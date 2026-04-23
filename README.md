# ken-spec

Minimal personal AI spec sync tool for Codex and Claude.

## Commands

- `npm run build`
- `node dist/bin.js init` — scaffold `.ken_spec/`
- `node dist/bin.js sync` — sync into `.codex/`, `.claude/`, and managed blocks in `AGENTS.md` / `CLAUDE.md`
- `node dist/bin.js doctor` — validate state; warns on drift (hand-edited generated `SKILL.md`), missing sync targets, or invalid `config.yaml`. Exits non-zero only on errors.
- `node dist/bin.js clean [--dry-run]` — remove what `sync` produced (generated skill dirs + managed blocks). The `.ken_spec/` source is left untouched.

## What it does

- Creates a `.ken_spec/` source-of-truth directory
- Syncs `.ken_spec/skills/*.md` into `.codex/skills/*/SKILL.md`
- Syncs `.ken_spec/skills/*.md` into `.claude/skills/*/SKILL.md`
- Syncs built-in module skills from `.ken_spec/modules/*/skill.md`
- Scaffolds the built-in `postmortem` module and its project-local storage under `.ken_spec/data/postmortem/`
- Injects a managed Ken Spec block into `AGENTS.md` and `CLAUDE.md`

## Customizing postmortem rules

After `init`, edit `.ken_spec/modules/postmortem/rules.md` to define when to capture, what to record, where to store, and output constraints. The synced skill points agents at that file at runtime, so changes take effect on the next agent session without rerunning `sync`.
