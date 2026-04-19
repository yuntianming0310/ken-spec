# ken-spec

Minimal personal AI spec sync tool for Codex and Claude.

## Commands

- `npm run build`
- `node dist/bin.js init`
- `node dist/bin.js sync`

## What it does

- Creates a `.ken_spec/` source-of-truth directory
- Syncs `.ken_spec/skills/*.md` into `.codex/skills/*/SKILL.md`
- Syncs `.ken_spec/skills/*.md` into `.claude/skills/*/SKILL.md`
- Syncs built-in module skills from `.ken_spec/modules/*/skill.md`
- Scaffolds the built-in `postmortem` module and its project-local storage under `.ken_spec/data/postmortem/`
- Injects a managed Ken Spec block into `AGENTS.md` and `CLAUDE.md`
