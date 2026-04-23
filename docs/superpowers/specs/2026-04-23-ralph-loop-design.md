# Ralph Loop Module Design

**Date:** 2026-04-23
**Status:** Approved, ready for implementation planning

## Goal

Give ken-spec a structured, host-driven iterative refinement engine for generating high-quality artifacts (one-pagers, PRDs, RFCs, long-form docs). The engine is delivered as a new module `ralph-loop` that teaches the host AI agent (Claude Code or Codex CLI) to play Orchestrator and drive a five-role Generator/Evaluator loop via native subagent primitives (Claude Code `Task`, Codex `spawn_agent`).

The engine is markdown-only. ken-spec adds no runtime, no LLM SDK dependency, and no CLI subcommand for running the loop. The loop runs entirely inside a single host agent session by dispatching and coordinating subagents.

## Non-Goals

- Building an autonomous CLI runner that calls LLM APIs directly. Execution is always host-driven.
- Cross-vendor evaluation (e.g., mixing Anthropic + OpenAI + Google models for judge diversity). Same-vendor diversity via persona/rubric-dimension/temperature is sufficient for v1.
- Gemini CLI support. ken-spec targets Codex and Claude only.
- Code generation / refactoring use cases as the primary scenario. v1 targets long-form structured documents; the engine stays generic so B/C scenarios (code, decision/analysis) can be added later via additional rubric templates.
- User-facing config-level model overrides. Host-profile defaults are hardcoded in `references/host-profiles.md`; users edit the file directly if they need to override in v1.

## Architecture

### Roles

Five roles, executed as follows:

| Role | Executed by | Delivery mechanism |
|---|---|---|
| Orchestrator | Main agent (user's host session) | Reads `skill.md` and drives the full flow |
| Decomposer | Main agent (in-session sub-step) | Guidance in `skill.md` + `references/decomposition-heuristics.md` |
| Generator | Subagent | `prompts/generator.md` as subagent payload |
| Evaluator × N | Subagents dispatched in parallel | `prompts/evaluator.md` + per-persona placeholders |
| Assembler | Subagent (only when decomposition occurred) | `prompts/assembler.md` |

### Key Invariants

- **Orchestrator state lives in files, never in the main agent's working memory.** Current-best artifact, latest round, score history, regression notes — all persisted under `.ken_spec/data/ralph-loop/runs/<id>/`.
- **Subagent payloads are self-contained.** Each Generator/Evaluator/Assembler subagent receives exactly what it needs (rubric fragment, persona, current best, recent failure note) and does not inherit the main session's context.
- **Pre-flight self-check is mandatory.** Before starting any loop, the Orchestrator prints a startup plan covering: host (Claude Code / Codex), parallel-subagent capability, model-tier mapping for Reasoning/Quality/Judge, degradation mode, plan of action. The user can interrupt before any subagent is spawned.
- **No runtime in ken-spec itself.** ken-spec is only responsible for scaffolding (`init`) and mirroring (`sync`) the module's static assets.

### Data Flow (single run, happy path)

```
User invokes → Orchestrator self-check →
  Collect task-spec + rubric (interactive fast path OR file-driven slow path) →
  Decomposition judgment →
    [branch A: no split] single loop
    [branch B: split] N parallel sub-loops → Assembly loop
  Inside each loop:
    Generator produces round-N.md (baseline = best.md + merged feedback + latest regression note) →
    Evaluator × M parallel scoring (each evaluator only sees its assigned criteria) →
    Aggregate to total score →
    Update best.md if total > best.total →
    Check stop conditions (threshold / max_rounds / no-improve-K=2) →
    Continue or terminate
Final: emit runs/<id>/artifacts/best.md + summary.json digest.
```

## File Layout

### Source tree (scaffolded by `ken-spec init`)

```
.ken_spec/modules/ralph-loop/
├── README.md
├── skill.md                            Orchestrator behavior: trigger, self-check,
│                                       decomposition judgment, loop orchestration
├── prompts/
│   ├── generator.md                    Subagent payload template
│   ├── evaluator.md                    Subagent payload template with persona placeholder
│   └── assembler.md                    Subagent payload template
├── rubrics/
│   ├── README.md                       How to author rubrics; 0-100 scale explanation
│   ├── one-pager.yaml                  Built-in rubric for v1 scenario
│   └── assembly.yaml                   Built-in rubric for assembly consistency loop
├── references/
│   ├── host-profiles.md                Claude Code / Codex primitive + model-tier mapping
│   ├── decomposition-heuristics.md     Split/no-split scoring rules
│   └── iteration-log-schema.md         Field definitions for iteration-log.md and summary.json
└── templates/
    ├── task-spec.md                    Slow-path user template
    └── run-dir-readme.md               Template for per-run README
```

### Runtime tree (created per loop invocation; not synced, not init-scaffolded beyond `.gitkeep`)

```
.ken_spec/data/ralph-loop/
└── runs/<run-id>/                      run-id format: YYYY-MM-DD-<slug>-<short-hash>
                                          slug: kebab-case derivation of task subject or rubric name
                                          short-hash: 6 hex chars for uniqueness
    ├── README.md
    ├── inputs/
    │   ├── task-spec.md
    │   └── rubric.yaml
    ├── artifacts/
    │   ├── best.md                     Historical best (overwritten on improvement)
    │   └── round-<N>.md                Latest round only (overwritten each round; previous round files deleted)
    ├── scores/
    │   ├── round-<N>.json              Latest round's aggregated scores
    │   └── summary.json                Global state (see schema below)
    └── iteration-log.md                Human-readable append-only log
```

When decomposition occurs, `sub-runs/<sub-id>/` and `assembly/` subdirs appear under the main run directory, each mirroring the same internal structure.

## Rubric Format

Flat criteria list with explicit persona routing, 0-100 per-criterion scoring, weighted-sum aggregation.

```yaml
name: one-pager
version: 1
description: "One-page brief scoring (background / plan / features / timeline / risks)"
threshold: 80
max_rounds: 5
early_stop:
  no_improve_rounds: 2

criteria:
  - id: logic_rigor
    weight: 0.30
    rubric: |
      ... 0-100 scale description with anchor points ...
    evaluator: strict_technical
  - id: clarity
    weight: 0.25
    rubric: |
      ...
    evaluator: new_user
  - id: completeness
    weight: 0.25
    rubric: |
      ...
    evaluator: strict_technical
  - id: audience_fit
    weight: 0.20
    rubric: |
      ...
    evaluator: product_manager

personas:
  strict_technical:
    prompt: "You are a strict technical reviewer..."
    temperature: 0
  new_user:
    prompt: "You are a non-expert target reader..."
    temperature: 0.3
  product_manager:
    prompt: "You are a demanding product manager..."
    temperature: 0.3

aggregation:
  method: weighted_sum
```

Validation requirements (enforced at parse time by the Orchestrator when reading a rubric):

- `weight` values sum to 1.0 (±0.01 tolerance)
- Every `evaluator` field references a key present in `personas`
- `threshold`, `max_rounds`, `no_improve_rounds` present and positive
- At least one criterion

### Evaluator dispatch model

1. Orchestrator groups criteria by `evaluator`, producing one subagent per distinct persona. (Example: 4 criteria × 3 personas → 3 subagents, one per persona. One subagent may score 1+ criteria.)
2. Each Evaluator subagent receives only its assigned criteria's rubric text — never other criteria's rubric. This enforces perspective narrowing.
3. Each Evaluator returns structured JSON:
   ```json
   {
     "persona": "strict_technical",
     "scores": [
       { "criterion_id": "logic_rigor", "score": 82, "reasoning": "...", "suggestions": ["..."] },
       { "criterion_id": "completeness", "score": 75, "reasoning": "...", "suggestions": ["..."] }
     ]
   }
   ```
4. Orchestrator aggregates: `total = Σ(score_i × weight_i)`. Writes `scores/round-<N>.json` with per-criterion breakdown and merged deduped suggestions.

### Persona reuse

Personas defined in `personas` are rubric-local in v1. A future cross-rubric persona library (`.ken_spec/modules/ralph-loop/personas/`) can be introduced when a second built-in rubric (e.g., `prd.yaml`) repeats the same persona — YAGNI until then.

## Loop Control

### Artifact retention (A1)

Only two files persist in `artifacts/`:

- `best.md` — historical best
- `round-<N>.md` — latest round's output (overwritten by round N+1)

### Generator baseline (B1)

Every Generator invocation uses `best.md` as its starting point, not the latest round. Payload structure:

```
[TASK]
  {{task-spec content}}

[CURRENT BEST — round {{best_round}}, score {{best_total}}]
  {{best.md content}}

[AGGREGATED EVALUATOR FEEDBACK]
  - logic_rigor (82/100): {{suggestion}}
  - completeness (75/100): {{suggestion}}
  - ...

[MOST RECENT REGRESSION NOTE — if any]
  Round {{latest_round}} attempted "{{direction}}" but total dropped from {{best_total}} to {{latest_total}} (cause: {{reason_hint}}). Avoid this direction.

[INSTRUCTION]
  Based on best.md, make **targeted** improvements addressing the feedback above.
  Do not rewrite or expand scope. Modify only sections related to the feedback.
  Output the full improved version in Markdown.
```

### Stop conditions (C1, K=2)

Evaluated after each round, in order:

1. `total >= threshold` → `status = threshold_met`
2. `rounds_completed >= max_rounds` → `status = max_rounds`
3. `consecutive_no_improve >= 2` → `status = stopped_no_improve`
4. Otherwise continue

### summary.json schema

```json
{
  "run_id": "2026-04-23-one-pager-abc123",
  "rounds_completed": 3,
  "best_round": 2,
  "best_total": 83.5,
  "best_by_criterion": { "logic_rigor": 85, "clarity": 82, "completeness": 80, "audience_fit": 87 },
  "latest_round": 3,
  "latest_total": 79.0,
  "consecutive_no_improve": 1,
  "status": "running",
  "next_action": "generate_round_4",
  "regression_notes": [
    { "round": 3, "total": 79.0, "diff_vs_best": -4.5, "reason_hint": "clarity dropped 6 points" }
  ]
}
```

`status` enum: `running | threshold_met | max_rounds | stopped_no_improve | converged`.

`regression_notes` keeps at most 2 most recent entries (rolling). The Generator payload includes only the most recent one to limit tokens.

## Decomposition and Assembly

### Decomposition trigger (A3 — Orchestrator proposes, user confirms)

Orchestrator scores the task against these heuristics (in `references/decomposition-heuristics.md`):

- Estimated output > ~800 words → +1
- task-spec contains an explicit list of sub-sections or headings → +2
- Rubric includes a `completeness`-style criterion mentioning "multiple independent parts" → +1
- User explicitly requested "no split" → force 0

Split is proposed when total ≥ 2. Orchestrator outputs a proposed decomposition with per-section titles and target length, and the user confirms (`yes` / `modify` / `no`).

Maximum split fan-out in v1: **5 sub-modules**. Further splitting requires an explicit user request.

### Sub-loop structure (B3 — full independent sub-loops + assembly pass)

Each sub-loop:

- Has its own `sub-runs/<sub-id>/inputs/task-spec.md` (auto-derived from the main task-spec: section goal + word-count + section-local constraints + a summary of overall context)
- Has its own rubric derived from the main rubric by the Orchestrator using a simple heuristic: criteria whose scope is "per-section quality" (logic_rigor, clarity, completeness analogs) stay; criteria whose scope is "whole-artifact concern" (overall length/audience_fit analogs) are dropped from sub-rubrics and handled by the assembly rubric instead
- Runs as a sub-orchestrator subagent (Claude Code `Task(general-purpose, ...)` or Codex `spawn_agent(worker, ...)`)
- The sub-orchestrator runs the full Generator + Evaluator loop inside itself, including nested subagent dispatch
- Returns a pointer to its `sub-best.md` and `summary.json`

Sub-loops run in parallel (up to 5 concurrent).

### Assembly loop (C1 — always runs when decomposition occurred)

- Concatenate all `sub-best.md` in order → seed `assembly/round-1.md`
- Use `rubrics/assembly.yaml` (threshold 85, max_rounds 3, no_improve_rounds 1, 2-3 consistency criteria)
- Assembler subagent's prompt strictly forbids content changes: "Only adjust transitions, tone uniformity, format consistency. Do not alter claims, facts, or evidence. Flag content-level issues in a separate report without changing them."
- Output of assembly loop's `best.md` becomes the final run output (copied or symlinked to the main run's `artifacts/best.md`)

### Failure degradation

- If any sub-loop fails to meet threshold within max_rounds → proceed using its best-so-far into assembly; record "sub-loop did not converge" in main `summary.json`
- If assembly loop fails to meet threshold → return best-so-far + a report listing flagged consistency issues for manual resolution

## Host Profiles and Model Mapping

`references/host-profiles.md` is the source of truth for host detection and model-tier assignment. Its contents are also duplicated in `skill.md`'s self-check section so that the Orchestrator has the table available without a separate file read.

### Model tier defaults

| Tier | Claude Code | Codex CLI |
|---|---|---|
| Reasoning (Orchestrator, main agent) | `claude-opus-4-7` | `gpt-5.4-high` |
| Quality (Generator, Assembler subagents) | `claude-sonnet-4-6` | `gpt-5.4` |
| Judge (Evaluator subagents) | `claude-sonnet-4-6` | `gpt-5.4-mini` |

### Subagent primitive mapping

| Action | Claude Code | Codex CLI |
|---|---|---|
| Dispatch parallel subagents | `Task(general-purpose, prompt=...)` × N | `spawn_agent(agent_type="worker", message=...)` × N |
| Await result | Task returns directly | `wait` |
| Release slot | Automatic | `close_agent` |

### Pre-flight capability check

- **Claude Code**: `Task` is always available. Orchestrator proceeds.
- **Codex CLI**: Orchestrator checks for `[features] multi_agent = true` in `~/.codex/config.toml`. If absent, it prints remediation instructions and refuses to start the loop.
- **Any other host**: Orchestrator aborts with a clear message that Ralph Loop requires Claude Code or Codex.

### User overrides

Not supported in v1 via config. Users who want different models edit `references/host-profiles.md` directly (the file syncs to both `.claude/skills/ralph-loop/references/` and `.codex/skills/ralph-loop/references/`).

## ken-spec Source Changes

### New default content (`src/templates.ts`)

Add the following default-content functions. Each produces one file's content as a string constant:

- `getDefaultRalphLoopModuleReadme()`
- `getDefaultRalphLoopSkill()` — the Orchestrator-driving `skill.md`
- `getDefaultRalphLoopGeneratorPrompt()`
- `getDefaultRalphLoopEvaluatorPrompt()`
- `getDefaultRalphLoopAssemblerPrompt()`
- `getDefaultRalphLoopRubricsReadme()`
- `getDefaultRalphLoopOnePagerRubric()` — `one-pager.yaml` content
- `getDefaultRalphLoopAssemblyRubric()` — `assembly.yaml` content
- `getDefaultRalphLoopHostProfiles()`
- `getDefaultRalphLoopDecomposeHeuristics()`
- `getDefaultRalphLoopIterationLogSchema()`
- `getDefaultRalphLoopTaskSpecTemplate()`
- `getDefaultRalphLoopRunDirReadmeTemplate()`

### `src/commands/init.ts`

- Add `ensureDir` calls for: `modules/ralph-loop/{prompts,rubrics,references,templates}` and `data/ralph-loop/runs`
- Add `writeFileIfMissing` calls for every file listed in the source-tree layout above
- Drop a `.gitkeep` into `data/ralph-loop/runs/`

### `src/commands/sync.ts`

Add a new helper `mirrorModuleAssets(moduleSrcDir, moduleDstDir, assetDirs)`:

- Detect: for each module, if any of `{prompts, rubrics, references, templates}` subdirs exists under the source, mirror them
- Behavior: for each whitelisted asset subdir present at source, remove the corresponding subdir at destination, then recursively copy from source
- Excluded paths: `data/` and the module's `README.md` (the README stays in `.ken_spec/modules/<name>/` only)
- Hardcoded whitelist: `['prompts', 'rubrics', 'references', 'templates']`
- Called for every module during sync; no-ops for modules that have no asset subdirs (postmortem, style-review, commit-prep in their current shape)

Integration point: inside `syncSkillsToTool`, after `writeText(targetPath, renderSkillFile(skill))`, also invoke `mirrorModuleAssets` when the skill originates from a module directory.

### `src/commands/doctor.ts`

Add a check: for `.claude/skills/ralph-loop/` and `.codex/skills/ralph-loop/`, verify each of the four asset subdirs exists and is non-empty. Emit a warning listing any missing or empty subdir.

### `src/render.ts`

Expose the module source directory alongside the skill content so that sync can locate asset subdirs. Current `loadSkills` returns `{ name, content }` — extend to `{ name, content, sourceDir? }` where `sourceDir` is set for module-origin skills and unset for top-level skills.

### Unchanged

- `src/config.ts` and `config.yaml` structure. No new config keys.
- Behavior for postmortem, style-review, commit-prep. `mirrorModuleAssets` is a no-op on them because they have no asset subdirs.
- `AGENTS.md` / `CLAUDE.md` managed block content.

## Testing Strategy

New test file: `test/ralph-loop.test.ts`.

### Unit / integration coverage (Vitest)

1. **`init` scaffolds the full tree**
   - After `initProject(tmp)`, every file in the source-tree layout exists
   - `skill.md`, `prompts/*.md`, `rubrics/*.yaml`, `references/*.md`, `templates/*.md`, `README.md` are all non-empty
   - `data/ralph-loop/runs/.gitkeep` exists (empty, for git tracking)

2. **`sync` mirrors asset subdirs to both hosts**
   - `.claude/skills/ralph-loop/SKILL.md` exists with frontmatter
   - `.claude/skills/ralph-loop/{prompts,rubrics,references,templates}/` contents match source byte-for-byte
   - Same for `.codex/skills/ralph-loop/`
   - `.claude/skills/ralph-loop/data/` does **not** exist (data is not synced)
   - `.claude/skills/ralph-loop/README.md` does **not** exist (README is not synced)

3. **`sync` idempotency and cleanup**
   - Running `sync` twice produces identical output
   - A stray file manually added to `.claude/skills/ralph-loop/prompts/` is removed by the next `sync` (proves the clean-then-copy behavior)

4. **`sync` does not regress existing modules**
   - postmortem, style-review, commit-prep still have their SKILL.md written correctly
   - Their target skill dirs do **not** gain asset subdirs

5. **`doctor` detects missing assets**
   - Clean `init + sync` → `doctor` passes
   - Manually delete `.claude/skills/ralph-loop/prompts/generator.md` → `doctor` reports the issue

6. **Built-in rubric YAML is valid**
   - Parse `one-pager.yaml` and `assembly.yaml`; assert required fields (`threshold`, `max_rounds`, `criteria` non-empty, every criterion's `evaluator` exists in `personas`, weights sum to 1.0)

### Out of scope for automated testing

- Host-agent execution of `skill.md` (depends on Claude Code / Codex runtime)
- Loop convergence, score correctness, subagent orchestration correctness (end-to-end, manual)

### Manual acceptance

1. Run `init + sync` inside ken-spec's own repo
2. Open Claude Code and have it run Ralph Loop to produce a one-pager for the ken-spec project
3. Verify: self-check output is compliant, decomposition proposal is reasonable, loop converges, `best.md` is usable
4. Repeat in Codex CLI (with `[features] multi_agent = true` configured)

## Open Questions Deferred to Implementation Planning

- Exact wording of `skill.md`'s self-check section and the five subagent prompt templates (large content; will be drafted during implementation per-file with review)
- Whether `mirrorModuleAssets` uses `fs.cp` recursive (Node 16.7+) or a manual walk (for broader compatibility); decide based on the current Node engine policy of ken-spec
- Whether `render.ts` extension breaks the existing `loadSkills` return-type consumers; audit during implementation
