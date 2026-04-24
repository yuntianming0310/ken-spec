# Ralph Loop Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ralph-loop` module to ken-spec that scaffolds a host-driven iterative-refinement engine (skill.md, prompts, rubrics, references, templates) into `.ken_spec/modules/ralph-loop/`, and syncs its prompt/rubric/reference/template asset subdirs to `.claude/skills/ralph-loop/` and `.codex/skills/ralph-loop/` on every `sync` run.

**Architecture:** Thirteen template helpers in `templates.ts` produce the module's static file content. `init.ts` scaffolds the source tree (including a `data/ralph-loop/runs/.gitkeep`). `render.ts`'s `loadSkills` return type is extended with an optional `sourceDir` field that `sync.ts` uses to locate asset subdirs and drive a new `mirrorModuleAssets` helper (clean-then-copy, whitelist: `prompts rubrics references templates`). `doctor.ts` gains one additional check: for each enabled tool's `ralph-loop` skill dir, assert all four asset subdirs are present and non-empty. A new test file `test/ralph-loop.test.ts` exercises every new behaviour with Vitest.

**Tech Stack:** Node.js >=20.19 (ESM, NodeNext), TypeScript 5.x, Vitest, `node:fs/promises` (`fs.cp` recursive, available since Node 16.7), no new dependencies.

**Repo layout reminders:**
- All source paths are relative to `/Users/wenbokang/projects/ken-spec`.
- ESM with NodeNext — imports use explicit `.js` extensions even for `.ts` sources.
- Test runner: `npm test` (all), `npx vitest run test/<name>.test.ts` (single file).
- Commit style: Conventional Commits (`feat: …`, `test: …`), one line.

---

### Task 1: Add template helpers for all ralph-loop module files

**Files:**
- Modify: `src/templates.ts`

This is the only content-authoring task. Every other task depends on these helpers existing.

The module's static files fall into seven groups: README, skill.md (Orchestrator), prompts (generator / evaluator / assembler), rubrics README + two YAML rubrics, three references, and two templates. Each becomes one exported function.

- [x] **Step 1: Append `getDefaultRalphLoopModuleReadme`**

Append to `src/templates.ts` (after the existing `getDefaultCommitPrepSkill`):

```ts
export function getDefaultRalphLoopModuleReadme(): string {
  return [
    '# Ralph Loop Module',
    '',
    'Provides the `ralph-loop` skill to Codex and Claude Code.',
    '',
    'Ralph Loop is a host-driven iterative refinement engine for generating high-quality long-form artifacts (one-pagers, PRDs, RFCs). The host AI agent (Claude Code or Codex CLI) acts as Orchestrator, dispatching Generator, Evaluator, and Assembler subagents in a scored loop.',
    '',
    '## Key files',
    '- `skill.md` — Orchestrator behavior: trigger, self-check, decomposition judgment, loop control',
    '- `prompts/` — Generator, Evaluator, and Assembler subagent payload templates',
    '- `rubrics/` — Built-in rubrics (`one-pager.yaml`, `assembly.yaml`) and authoring guide',
    '- `references/` — Host-profile model-tier mapping, decomposition heuristics, iteration-log schema',
    '- `templates/` — Slow-path task-spec template and per-run README template',
    '',
    '## Runtime data',
    'Loop runs write to `.ken_spec/data/ralph-loop/runs/<run-id>/`. That tree is never synced.',
    '',
    '## Customising',
    'Edit rubric YAML files in `rubrics/` to change scoring criteria, personas, threshold, or max_rounds.',
    'Model-tier defaults live in `references/host-profiles.md` — edit there to override models.',
    '',
  ].join('\n');
}
```

- [x] **Step 2: Append `getDefaultRalphLoopSkill`**

```ts
export function getDefaultRalphLoopSkill(): string {
  return [
    '# Ralph Loop — Orchestrator Skill',
    '',
    '## Trigger',
    '',
    'Use this skill when the user asks to generate, refine, or improve a long-form structured document (one-pager, PRD, RFC, brief) through iterative AI feedback.',
    '',
    '## Pre-flight Self-Check (mandatory before spawning any subagent)',
    '',
    'Before starting, print the following plan and wait for the user to confirm (press Enter) or interrupt (Ctrl-C):',
    '',
    '```',
    'Ralph Loop self-check',
    '─────────────────────',
    'Host:              <Claude Code | Codex CLI | UNKNOWN>',
    'Parallel subagents: <yes | no — see remediation below>',
    'Reasoning tier:    <model name>',
    'Quality tier:      <model name>',
    'Judge tier:        <model name>',
    'Degradation mode:  <none | serial-fallback>',
    '',
    'Planned action:',
    '  1. Collect task-spec and rubric (interactive or file-driven)',
    '  2. Score task for decomposition',
    '  3. Run Generator → Evaluator loop (up to max_rounds rounds)',
    '  4. Emit best.md + summary.json',
    '',
    'Awaiting user confirmation…',
    '```',
    '',
    '### Host detection and model-tier mapping',
    '',
    '| Tier | Claude Code | Codex CLI |',
    '|---|---|---|',
    '| Reasoning (Orchestrator) | `claude-opus-4-7` | `gpt-5.4-high` |',
    '| Quality (Generator, Assembler) | `claude-sonnet-4-6` | `gpt-5.4` |',
    '| Judge (Evaluator) | `claude-sonnet-4-6` | `gpt-5.4-mini` |',
    '',
    '- **Claude Code**: `Task` primitive is always available. Proceed.',
    '- **Codex CLI**: Check `~/.codex/config.toml` for `[features] multi_agent = true`. If absent, print:',
    '  ```',
    '  ERROR: Ralph Loop requires Codex multi-agent mode.',
    '  Add the following to ~/.codex/config.toml and retry:',
    '    [features]',
    '    multi_agent = true',
    '  ```',
    '  Then abort.',
    '- **Other host**: Abort with "Ralph Loop requires Claude Code or Codex CLI."',
    '',
    'Full table also available in `references/host-profiles.md`.',
    '',
    '## Step 1 — Collect inputs',
    '',
    '**Fast path (interactive):** Ask the user:',
    '1. "What is the subject of the document? (one sentence)"',
    '2. "Which rubric? (path to YAML, or press Enter for `rubrics/one-pager.yaml`)"',
    '3. "Any explicit constraints? (word count, audience, tone)"',
    '',
    'Save answers to `.ken_spec/data/ralph-loop/runs/<run-id>/inputs/task-spec.md` using the task-spec template at `templates/task-spec.md`.',
    '',
    '**Slow path (file-driven):** If the user points to an existing task-spec file, load it directly.',
    '',
    'Load and validate the rubric YAML (see Rubric Validation below).',
    '',
    '## Step 2 — Decomposition judgment',
    '',
    'Score the task using heuristics in `references/decomposition-heuristics.md`. Score ≥ 2 triggers a split proposal.',
    '',
    'Propose decomposition to user with proposed section titles and target lengths. User responds `yes`, `modify`, or `no`.',
    '',
    '- **no split:** proceed to Step 3 with the full task.',
    '- **split (max 5 sub-modules):** create sub-runs under `sub-runs/<sub-id>/`, dispatch N parallel sub-orchestrator subagents (each runs its own full loop), then run the assembly loop (Step 4).',
    '',
    '## Step 3 — Generator → Evaluator loop',
    '',
    'Repeat until a stop condition fires:',
    '',
    '1. **Generate:** Dispatch a Generator subagent (payload from `prompts/generator.md`) using `best.md` as baseline plus merged evaluator feedback and the most recent regression note (if any). Write output to `artifacts/round-<N>.md`. If N > 1, delete `artifacts/round-<N-1>.md`.',
    '2. **Evaluate:** Group rubric criteria by `evaluator` persona. Dispatch one Evaluator subagent per distinct persona in parallel (payload from `prompts/evaluator.md`). Each subagent returns JSON: `{ "persona": "...", "scores": [{ "criterion_id": "...", "score": 0-100, "reasoning": "...", "suggestions": ["..."] }] }`.',
    '3. **Aggregate:** `total = Σ(score_i × weight_i)`. Write `scores/round-<N>.json`.',
    '4. **Update best:** If `total > best_total` from `summary.json`, overwrite `artifacts/best.md` and update `summary.json`.',
    '5. **Check stop conditions** (in order):',
    '   - `total >= threshold` → `status = threshold_met`, stop',
    '   - `rounds_completed >= max_rounds` → `status = max_rounds`, stop',
    '   - `consecutive_no_improve >= 2` → `status = stopped_no_improve`, stop',
    '   - Otherwise: increment round, loop',
    '6. **Log:** Append a human-readable entry to `iteration-log.md` after each round.',
    '',
    '### Regression notes',
    '',
    'When total drops below best_total: record `{ round, total, diff_vs_best, reason_hint }` in `summary.json` regression_notes (max 2, rolling). Include the most recent entry in the next Generator payload.',
    '',
    '## Step 4 — Assembly loop (only when decomposition occurred)',
    '',
    '1. Concatenate sub-loop `best.md` outputs in order → `assembly/round-1.md`.',
    '2. Run the Generator → Evaluator loop using `rubrics/assembly.yaml` (threshold 85, max_rounds 3, no_improve_rounds 1).',
    '3. Assembler subagent (payload from `prompts/assembler.md`) may only adjust transitions, tone uniformity, format consistency — it must never alter claims, facts, or evidence.',
    '4. Copy final `assembly/best.md` to main run\'s `artifacts/best.md`.',
    '',
    '## Rubric Validation',
    '',
    'Before running the loop, validate the loaded rubric YAML:',
    '- `threshold`, `max_rounds`, `early_stop.no_improve_rounds` present and > 0',
    '- `criteria` non-empty',
    '- Every criterion\'s `evaluator` key exists in `personas`',
    '- `weight` values sum to 1.0 (± 0.01 tolerance)',
    '',
    'If validation fails, print a clear error and abort.',
    '',
    '## Final output',
    '',
    'Emit `runs/<run-id>/artifacts/best.md` and `runs/<run-id>/scores/summary.json`.',
    'Print a one-paragraph summary: run-id, rounds completed, best score, best round, stop reason.',
    '',
  ].join('\n');
}
```

- [x] **Step 3: Append `getDefaultRalphLoopGeneratorPrompt`**

```ts
export function getDefaultRalphLoopGeneratorPrompt(): string {
  return [
    '# Ralph Loop — Generator Subagent Prompt',
    '',
    'You are a Generator subagent in an iterative refinement loop. Your sole job is to produce an improved version of the document described below.',
    '',
    '---',
    '',
    '[TASK]',
    '{{task-spec content}}',
    '',
    '[CURRENT BEST — round {{best_round}}, score {{best_total}}]',
    '{{best.md content}}',
    '',
    '[AGGREGATED EVALUATOR FEEDBACK]',
    '{{merged_feedback}}',
    '',
    '[MOST RECENT REGRESSION NOTE — include only if present]',
    'Round {{latest_round}} attempted "{{direction}}" but total dropped from {{best_total}} to {{latest_total}} (cause: {{reason_hint}}). Avoid this direction.',
    '',
    '[INSTRUCTION]',
    'Based on the Current Best above, make **targeted** improvements that address the Evaluator Feedback.',
    'Do NOT rewrite from scratch. Do NOT expand the scope beyond what the task-spec defines.',
    'Modify only sections directly related to the feedback items.',
    'Output the full improved version in Markdown — nothing else.',
    '',
  ].join('\n');
}
```

- [x] **Step 4: Append `getDefaultRalphLoopEvaluatorPrompt`**

```ts
export function getDefaultRalphLoopEvaluatorPrompt(): string {
  return [
    '# Ralph Loop — Evaluator Subagent Prompt',
    '',
    '{{persona_prompt}}',
    '',
    'You are evaluating a document on the specific criteria assigned to you. Score each criterion independently on a 0-100 scale using the rubric text provided.',
    '',
    '---',
    '',
    '[DOCUMENT TO EVALUATE]',
    '{{round_N_content}}',
    '',
    '[TASK CONTEXT]',
    '{{task-spec content}}',
    '',
    '[YOUR ASSIGNED CRITERIA]',
    '{{assigned_criteria_rubric_text}}',
    '',
    '[INSTRUCTION]',
    'Return ONLY valid JSON in exactly this shape — no prose, no markdown fences:',
    '{',
    '  "persona": "{{persona_name}}",',
    '  "scores": [',
    '    {',
    '      "criterion_id": "<id>",',
    '      "score": <0-100 integer>,',
    '      "reasoning": "<one sentence>",',
    '      "suggestions": ["<concrete actionable improvement>"]',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Score only the criteria listed in YOUR ASSIGNED CRITERIA. Do not score others.',
    '- reasoning must reference specific text in the document.',
    '- Each suggestions item must be a concrete, actionable change (not "improve clarity").',
    '',
  ].join('\n');
}
```

- [x] **Step 5: Append `getDefaultRalphLoopAssemblerPrompt`**

```ts
export function getDefaultRalphLoopAssemblerPrompt(): string {
  return [
    '# Ralph Loop — Assembler Subagent Prompt',
    '',
    'You are an Assembler subagent. You receive a concatenated document assembled from independently-refined sections.',
    '',
    '---',
    '',
    '[ASSEMBLED DOCUMENT]',
    '{{concatenated_sub_best_content}}',
    '',
    '[ASSEMBLY RUBRIC FEEDBACK]',
    '{{merged_assembly_feedback}}',
    '',
    '[INSTRUCTION]',
    'Improve only the following aspects — nothing else:',
    '- Transitions between sections (add or smooth connecting sentences)',
    '- Tone uniformity (consistent register, no jarring shifts)',
    '- Format consistency (heading levels, bullet style, spacing)',
    '',
    '**Strictly forbidden:**',
    '- Altering any claim, fact, figure, or evidence',
    '- Reordering sections',
    '- Adding new content',
    '- Removing content',
    '',
    'If you identify content-level issues (contradictions, factual conflicts), do NOT change them.',
    'Instead, append a separate "Content Issues Report" section at the end of your output, listing each issue with its location.',
    '',
    'Output the full revised document in Markdown, followed by the Content Issues Report (if any).',
    '',
  ].join('\n');
}
```

- [x] **Step 6: Append `getDefaultRalphLoopRubricsReadme`**

```ts
export function getDefaultRalphLoopRubricsReadme(): string {
  return [
    '# Ralph Loop Rubrics',
    '',
    '## How to author a rubric',
    '',
    'Rubrics are YAML files. Required top-level fields:',
    '',
    '```yaml',
    'name: <short-slug>',
    'version: 1',
    'description: "<human-readable label>"',
    'threshold: <0-100>          # stop when total score reaches this',
    'max_rounds: <integer>       # hard cap on loop iterations',
    'early_stop:',
    '  no_improve_rounds: <integer>  # stop after K consecutive non-improving rounds',
    '',
    'criteria:',
    '  - id: <snake_case_id>',
    '    weight: <0.0-1.0>       # all weights must sum to 1.0 (±0.01)',
    '    rubric: |               # 0-100 scale description with anchor points',
    '      ...',
    '    evaluator: <persona_key>',
    '',
    'personas:',
    '  <persona_key>:',
    '    prompt: "You are a ..."',
    '    temperature: <0.0-1.0>',
    '',
    'aggregation:',
    '  method: weighted_sum',
    '```',
    '',
    '## 0-100 scoring scale convention',
    '',
    '| Range | Meaning |',
    '|---|---|',
    '| 90-100 | Excellent — no meaningful improvement available |',
    '| 75-89 | Good — minor gaps only |',
    '| 60-74 | Acceptable — notable gaps that limit usefulness |',
    '| 40-59 | Weak — significant issues; substantial revision needed |',
    '| 0-39 | Failing — fundamental problems; near-full rewrite needed |',
    '',
    '## Validation rules',
    '',
    '- `weight` values must sum to 1.0 (±0.01 tolerance)',
    '- Every criterion\'s `evaluator` must reference a key in `personas`',
    '- `threshold`, `max_rounds`, `no_improve_rounds` must be present and positive',
    '- At least one criterion required',
    '',
  ].join('\n');
}
```

- [x] **Step 7: Append `getDefaultRalphLoopOnePagerRubric`**

```ts
export function getDefaultRalphLoopOnePagerRubric(): string {
  return [
    'name: one-pager',
    'version: 1',
    'description: "One-page brief scoring (background / plan / features / timeline / risks)"',
    'threshold: 80',
    'max_rounds: 5',
    'early_stop:',
    '  no_improve_rounds: 2',
    '',
    'criteria:',
    '  - id: logic_rigor',
    '    weight: 0.30',
    '    rubric: |',
    '      Evaluate whether the document\'s reasoning is tight, claims are backed, and the logic',
    '      chain from problem to solution is sound.',
    '      90-100: every claim supported, no logical gaps, assumptions explicit',
    '      75-89: minor unsupported claims; overall logic holds',
    '      60-74: notable gaps or circular reasoning in ≥1 section',
    '      40-59: central argument weak or unsupported',
    '      0-39: logic failures throughout; reader cannot follow the argument',
    '    evaluator: strict_technical',
    '  - id: clarity',
    '    weight: 0.25',
    '    rubric: |',
    '      Evaluate whether a non-expert target reader can understand every section without',
    '      prior domain knowledge.',
    '      90-100: every sentence clear; jargon defined; no ambiguity',
    '      75-89: occasional jargon or dense passage; mostly accessible',
    '      60-74: recurring clarity issues that slow comprehension',
    '      40-59: large portions inaccessible to the target reader',
    '      0-39: document is incomprehensible to a non-expert',
    '    evaluator: new_user',
    '  - id: completeness',
    '    weight: 0.25',
    '    rubric: |',
    '      Evaluate whether all required sections are present and adequately covered:',
    '      background, plan, features, timeline, risks.',
    '      90-100: all five sections fully addressed with no gaps',
    '      75-89: all sections present; one has thin coverage',
    '      60-74: one section missing or substantially underdeveloped',
    '      40-59: two or more sections missing or skeletal',
    '      0-39: document is structurally incomplete',
    '    evaluator: strict_technical',
    '  - id: audience_fit',
    '    weight: 0.20',
    '    rubric: |',
    '      Evaluate whether the document\'s framing, tone, and level of detail match a senior',
    '      product decision-maker audience.',
    '      90-100: perfectly calibrated — right depth, right tone, right emphasis',
    '      75-89: minor calibration issues; overall appropriate',
    '      60-74: tone or depth noticeably off for the audience in ≥1 section',
    '      40-59: document is written for the wrong audience',
    '      0-39: completely misaligned with the intended audience',
    '    evaluator: product_manager',
    '',
    'personas:',
    '  strict_technical:',
    '    prompt: "You are a strict technical reviewer with high standards for logical rigor and evidence. You penalise vague claims, unsupported assertions, and circular reasoning. You do not penalise for prose style."',
    '    temperature: 0',
    '  new_user:',
    '    prompt: "You are a non-expert target reader encountering this document for the first time. You evaluate only whether you can understand and follow the content without prior domain knowledge."',
    '    temperature: 0.3',
    '  product_manager:',
    '    prompt: "You are a demanding senior product manager evaluating whether this document gives you everything you need to make a confident decision. You care about framing, prioritisation, and business-relevant emphasis."',
    '    temperature: 0.3',
    '',
    'aggregation:',
    '  method: weighted_sum',
    '',
  ].join('\n');
}
```

- [x] **Step 8: Append `getDefaultRalphLoopAssemblyRubric`**

```ts
export function getDefaultRalphLoopAssemblyRubric(): string {
  return [
    'name: assembly',
    'version: 1',
    'description: "Assembly consistency rubric for multi-section documents"',
    'threshold: 85',
    'max_rounds: 3',
    'early_stop:',
    '  no_improve_rounds: 1',
    '',
    'criteria:',
    '  - id: transition_quality',
    '    weight: 0.40',
    '    rubric: |',
    '      Evaluate whether transitions between independently-written sections are smooth and',
    '      maintain narrative continuity.',
    '      90-100: every section boundary is seamless; reader does not notice the join',
    '      75-89: minor abruptness at 1-2 boundaries; overall flow acceptable',
    '      60-74: noticeable jarring transitions at ≥2 boundaries',
    '      40-59: half or more of boundaries are awkward or abrupt',
    '      0-39: document feels like disconnected fragments throughout',
    '    evaluator: prose_editor',
    '  - id: tone_uniformity',
    '    weight: 0.35',
    '    rubric: |',
    '      Evaluate whether register, formality level, and voice are consistent throughout.',
    '      90-100: perfectly uniform — impossible to detect section boundaries by tone',
    '      75-89: minor tonal shifts; overall register consistent',
    '      60-74: noticeable register shifts in ≥1 section',
    '      40-59: multiple sections clash in tone',
    '      0-39: document is tonally incoherent',
    '    evaluator: prose_editor',
    '  - id: format_consistency',
    '    weight: 0.25',
    '    rubric: |',
    '      Evaluate whether heading levels, bullet style, capitalisation, and whitespace are',
    '      consistent throughout.',
    '      90-100: perfectly consistent formatting throughout',
    '      75-89: 1-2 minor inconsistencies (e.g., one heading level mismatch)',
    '      60-74: recurring formatting inconsistencies that distract',
    '      40-59: formatting is inconsistent in most sections',
    '      0-39: no discernible formatting system',
    '    evaluator: prose_editor',
    '',
    'personas:',
    '  prose_editor:',
    '    prompt: "You are a meticulous prose editor. You evaluate only surface-level consistency: transitions, tone, and formatting. You do not evaluate content quality, factual accuracy, or logical rigor — those are out of scope for your role."',
    '    temperature: 0',
    '',
    'aggregation:',
    '  method: weighted_sum',
    '',
  ].join('\n');
}
```

- [x] **Step 9: Append `getDefaultRalphLoopHostProfiles`**

```ts
export function getDefaultRalphLoopHostProfiles(): string {
  return [
    '# Ralph Loop — Host Profiles',
    '',
    'This file is the source of truth for host detection and model-tier defaults.',
    'Its key table is duplicated inside `skill.md`\'s self-check section for zero-file-read access.',
    'If you change model names here, also update `skill.md`.',
    '',
    '## Supported hosts',
    '',
    '| Host | Detection method |',
    '|---|---|',
    '| Claude Code | Environment variable `CLAUDE_CODE` present OR `Task` primitive callable |',
    '| Codex CLI | `~/.codex/config.toml` readable |',
    '| Other | Neither condition met — abort |',
    '',
    '## Model-tier defaults',
    '',
    '| Tier | Claude Code | Codex CLI |',
    '|---|---|---|',
    '| Reasoning (Orchestrator, main agent) | `claude-opus-4-7` | `gpt-5.4-high` |',
    '| Quality (Generator, Assembler subagents) | `claude-sonnet-4-6` | `gpt-5.4` |',
    '| Judge (Evaluator subagents) | `claude-sonnet-4-6` | `gpt-5.4-mini` |',
    '',
    '## Subagent primitive mapping',
    '',
    '| Action | Claude Code | Codex CLI |',
    '|---|---|---|',
    '| Dispatch parallel subagents | `Task(general-purpose, prompt=…)` × N | `spawn_agent(agent_type="worker", message=…)` × N |',
    '| Await result | Task returns directly | `wait` |',
    '| Release slot | Automatic | `close_agent` |',
    '',
    '## Pre-flight capability check',
    '',
    '- **Claude Code:** `Task` is always available. Proceed.',
    '- **Codex CLI:** Check `~/.codex/config.toml` for `[features] multi_agent = true`.',
    '  If absent, print:',
    '  ```',
    '  ERROR: Ralph Loop requires Codex multi-agent mode.',
    '  Add the following to ~/.codex/config.toml and retry:',
    '    [features]',
    '    multi_agent = true',
    '  ```',
    '  Then abort.',
    '- **Other host:** Abort with "Ralph Loop requires Claude Code or Codex CLI."',
    '',
    '## User overrides (v1)',
    '',
    'v1 does not expose config-level model overrides. Edit this file directly to change defaults.',
    'Changes here take effect in the next agent session after `ken-spec sync` is re-run.',
    '',
  ].join('\n');
}
```

- [x] **Step 10: Append `getDefaultRalphLoopDecomposeHeuristics`**

```ts
export function getDefaultRalphLoopDecomposeHeuristics(): string {
  return [
    '# Ralph Loop — Decomposition Heuristics',
    '',
    'The Orchestrator scores the task against these rules to decide whether to propose a split.',
    'A split is proposed when the total score is ≥ 2.',
    '',
    '## Scoring rules',
    '',
    '| Condition | Score |',
    '|---|---|',
    '| Estimated output > ~800 words | +1 |',
    '| task-spec contains an explicit list of sub-sections or headings | +2 |',
    '| Rubric includes a `completeness`-style criterion mentioning "multiple independent parts" | +1 |',
    '| User explicitly requested "no split" | Force total = 0 (override all other scores) |',
    '',
    '## Maximum fan-out',
    '',
    'v1 cap: **5 sub-modules**. Further splitting requires explicit user request.',
    '',
    '## Confirmation flow',
    '',
    'When total ≥ 2, the Orchestrator outputs a proposed decomposition:',
    '',
    '```',
    'Proposed decomposition (total heuristic score: N):',
    '  Sub-module 1: <title> (~<word-count> words)',
    '  Sub-module 2: <title> (~<word-count> words)',
    '  ...',
    '',
    'Reply:',
    '  yes     — proceed with this split',
    '  modify  — edit the list above and resend',
    '  no      — skip split, run as single task',
    '```',
    '',
    '## Sub-rubric derivation',
    '',
    'When splitting, the Orchestrator derives per-section rubrics from the main rubric:',
    '- Criteria whose scope is "per-section quality" (e.g., `logic_rigor`, `clarity`, `completeness`) → included in sub-rubrics',
    '- Criteria whose scope is "whole-artifact concern" (e.g., `audience_fit`, overall length) → dropped from sub-rubrics, evaluated only in the assembly rubric',
    '',
    'The Orchestrator must use judgment when categorising — the distinction is not encoded in the YAML.',
    '',
  ].join('\n');
}
```

- [x] **Step 11: Append `getDefaultRalphLoopIterationLogSchema`**

```ts
export function getDefaultRalphLoopIterationLogSchema(): string {
  return [
    '# Ralph Loop — Iteration Log Schema',
    '',
    'This file defines the field schemas for `iteration-log.md` (human-readable append-only log) and `scores/summary.json` (machine-readable state).',
    '',
    '## summary.json schema',
    '',
    '```json',
    '{',
    '  "run_id": "YYYY-MM-DD-<slug>-<6-hex-chars>",',
    '  "rounds_completed": 3,',
    '  "best_round": 2,',
    '  "best_total": 83.5,',
    '  "best_by_criterion": { "logic_rigor": 85, "clarity": 82, "completeness": 80, "audience_fit": 87 },',
    '  "latest_round": 3,',
    '  "latest_total": 79.0,',
    '  "consecutive_no_improve": 1,',
    '  "status": "running",',
    '  "next_action": "generate_round_4",',
    '  "regression_notes": [',
    '    { "round": 3, "total": 79.0, "diff_vs_best": -4.5, "reason_hint": "clarity dropped 6 points" }',
    '  ]',
    '}',
    '```',
    '',
    '### `status` enum',
    '',
    '| Value | Meaning |',
    '|---|---|',
    '| `running` | Loop is active |',
    '| `threshold_met` | `total >= threshold` |',
    '| `max_rounds` | `rounds_completed >= max_rounds` |',
    '| `stopped_no_improve` | `consecutive_no_improve >= no_improve_rounds` |',
    '| `converged` | Reserved for future use |',
    '',
    '### `regression_notes`',
    '',
    'Rolling window of at most 2 most recent entries. The Generator payload includes only the most recent one to limit token usage.',
    '',
    '## iteration-log.md format',
    '',
    'Append-only Markdown. Each round appends one entry:',
    '',
    '```markdown',
    '## Round N — YYYY-MM-DD HH:MM UTC',
    '',
    '**Total score:** 83.5 (best so far: 83.5, round 2)',
    '**Stop check:** threshold=80 → not met | max_rounds=5 → not met | no_improve=0/2 → not met',
    '**Status:** running → generate_round_4',
    '',
    '### Per-criterion scores',
    '| Criterion | Score | Weight | Weighted |',
    '|---|---|---|---|',
    '| logic_rigor | 85 | 0.30 | 25.5 |',
    '| clarity | 82 | 0.25 | 20.5 |',
    '| completeness | 80 | 0.25 | 20.0 |',
    '| audience_fit | 87 | 0.20 | 17.4 |',
    '',
    '### Suggestions (merged, deduped)',
    '- [logic_rigor] ...',
    '- [clarity] ...',
    '```',
    '',
  ].join('\n');
}
```

- [x] **Step 12: Append `getDefaultRalphLoopTaskSpecTemplate`**

```ts
export function getDefaultRalphLoopTaskSpecTemplate(): string {
  return [
    '# Ralph Loop Task Spec',
    '',
    '<!-- Fill in this template when using the slow-path (file-driven) input mode. -->',
    '<!-- Save as .ken_spec/data/ralph-loop/runs/<run-id>/inputs/task-spec.md -->',
    '',
    '## Subject',
    '',
    '<!-- One sentence: what document are we producing? -->',
    '',
    'Produce a one-pager for: <subject>',
    '',
    '## Audience',
    '',
    '<!-- Who will read the final document? -->',
    '',
    '<audience>',
    '',
    '## Required sections',
    '',
    '<!-- List the sections the document must include. -->',
    '',
    '- Background',
    '- Plan',
    '- Features',
    '- Timeline',
    '- Risks',
    '',
    '## Constraints',
    '',
    '<!-- Hard constraints: word count, tone, format, things to avoid. -->',
    '',
    '- Target length: ~500 words',
    '- Tone: professional, concise',
    '',
    '## Context',
    '',
    '<!-- Any background material, existing drafts, or reference links. -->',
    '',
    '<optional>',
    '',
  ].join('\n');
}
```

- [x] **Step 13: Append `getDefaultRalphLoopRunDirReadmeTemplate`**

```ts
export function getDefaultRalphLoopRunDirReadmeTemplate(): string {
  return [
    '# Ralph Loop Run — {{run_id}}',
    '',
    '**Started:** {{start_time}}',
    '**Rubric:** {{rubric_name}} (threshold {{threshold}}, max_rounds {{max_rounds}})',
    '**Status:** {{status}}',
    '',
    '## Directory layout',
    '',
    '```',
    'inputs/',
    '  task-spec.md    User-provided task specification',
    '  rubric.yaml     Rubric used for this run (copy of source)',
    'artifacts/',
    '  best.md         Historical best output (overwritten on improvement)',
    '  round-<N>.md    Latest round\'s raw output (overwritten each round)',
    'scores/',
    '  round-<N>.json  Latest round\'s per-criterion scores',
    '  summary.json    Global run state (see references/iteration-log-schema.md)',
    'iteration-log.md  Human-readable append-only round history',
    '```',
    '',
    '## Quick summary',
    '',
    'Rounds completed: {{rounds_completed}}',
    'Best score:       {{best_total}} (round {{best_round}})',
    'Stop reason:      {{status}}',
    '',
  ].join('\n');
}
```

- [x] **Step 14: Build and confirm compile**

Run: `npm run build`
Expected: exits 0 with no TypeScript errors.

- [x] **Step 15: Commit**

```bash
git add src/templates.ts
git commit -m "feat: add ralph-loop template helpers (13 functions)"
```

---

### Task 2: Extend `render.ts` — add `sourceDir` to `SkillSource`

**Files:**
- Modify: `src/render.ts`

The spec requires sync to know which skills originate from a module directory so it can locate asset subdirs. The return type of `loadSkills` gains an optional `sourceDir` field. This task must precede Task 3 (sync wiring) and Task 5 (doctor check) because both consume the new field.

- [ ] **Step 1: Write the failing test**

Create `test/ralph-loop.test.ts`:

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeTempProject } from './helpers.js';
import { initProject } from '../src/commands/init.js';
import { loadSkills } from '../src/render.js';

describe('loadSkills — sourceDir field', () => {
  it('sets sourceDir for module-origin skills and leaves it undefined for top-level skills', async () => {
    const projectRoot = await makeTempProject('ken-spec-render-sourcedir');
    await initProject(projectRoot);

    const skills = await loadSkills(projectRoot);

    const projectSkill = skills.find((s) => s.name === 'project');
    expect(projectSkill).toBeDefined();
    expect(projectSkill!.sourceDir).toBeUndefined();

    const ralphSkill = skills.find((s) => s.name === 'ralph-loop');
    expect(ralphSkill).toBeDefined();
    expect(ralphSkill!.sourceDir).toBe(
      path.join(projectRoot, '.ken_spec', 'modules', 'ralph-loop')
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/ralph-loop.test.ts`
Expected: FAIL — `SkillSource` has no `sourceDir` property, TypeScript error or runtime `undefined` mismatch.

- [ ] **Step 3: Extend `SkillSource` and `loadModuleSkills` in `src/render.ts`**

Replace lines 1-9 (the interface declaration) with:

```ts
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { renderManagedBlock } from './markers.js';

export interface SkillSource {
  name: string;
  content: string;
  /** Absolute path to the module directory. Defined only for module-origin skills. */
  sourceDir?: string;
}
```

Then replace the inner push inside `loadModuleSkills` (lines 75-79 of current file) so it includes `sourceDir`:

```ts
      skills.push({
        name: moduleDir.name,
        content,
        sourceDir: path.join(modulesDir, moduleDir.name),
      });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/ralph-loop.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all tests pass. The `renderSkillFile` and all consumers of `SkillSource` only use `name` and `content` — adding an optional field is backward-compatible.

- [ ] **Step 6: Commit**

```bash
git add src/render.ts test/ralph-loop.test.ts
git commit -m "feat(render): expose sourceDir on SkillSource for module-origin skills"
```

---

### Task 3: Add `mirrorModuleAssets` to `sync.ts`

**Files:**
- Modify: `src/commands/sync.ts`

`mirrorModuleAssets` is a new helper called per-module during sync. It clean-then-copies four whitelisted subdirs (`prompts`, `rubrics`, `references`, `templates`) from the module source to each tool's skill output directory. It no-ops on modules that have none of those subdirs (postmortem, style-review, commit-prep stay unaffected).

Depends on Task 2 (needs `sourceDir` on `SkillSource`).

- [ ] **Step 1: Write failing tests for asset mirroring (append to `test/ralph-loop.test.ts`)**

```ts
import { promises as fs } from 'node:fs';
import { syncProject } from '../src/commands/sync.js';

describe('syncProject — ralph-loop asset mirroring', () => {
  it('mirrors prompts, rubrics, references, templates to both tool dirs', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-assets');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    const assetDirs = ['prompts', 'rubrics', 'references', 'templates'];
    for (const tool of ['.claude', '.codex']) {
      for (const assetDir of assetDirs) {
        const dirPath = path.join(projectRoot, tool, 'skills', 'ralph-loop', assetDir);
        const entries = await fs.readdir(dirPath);
        expect(entries.length).toBeGreaterThan(0);
      }
    }
  });

  it('does not sync data/ or README.md to tool dirs', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-no-data');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    for (const tool of ['.claude', '.codex']) {
      const dataPath = path.join(projectRoot, tool, 'skills', 'ralph-loop', 'data');
      await expect(fs.access(dataPath)).rejects.toThrow();

      const readmePath = path.join(projectRoot, tool, 'skills', 'ralph-loop', 'README.md');
      await expect(fs.access(readmePath)).rejects.toThrow();
    }
  });

  it('removes stray files from asset subdirs on re-sync (clean-then-copy)', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-clean');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    // Manually plant a stray file in the synced prompts dir
    const strayPath = path.join(projectRoot, '.claude', 'skills', 'ralph-loop', 'prompts', 'stray.md');
    await fs.writeFile(strayPath, 'stray', 'utf8');

    // Re-sync
    await syncProject(projectRoot);

    // Stray file must be gone
    await expect(fs.access(strayPath)).rejects.toThrow();
  });

  it('does not add asset subdirs to modules that have none (postmortem, style-review, commit-prep)', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-noop');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    for (const moduleName of ['postmortem', 'style-review', 'commit-prep']) {
      for (const tool of ['.claude', '.codex']) {
        for (const assetDir of ['prompts', 'rubrics', 'references', 'templates']) {
          const dirPath = path.join(projectRoot, tool, 'skills', moduleName, assetDir);
          await expect(fs.access(dirPath)).rejects.toThrow();
        }
      }
    }
  });

  it('sync is idempotent — running twice produces identical output', async () => {
    const projectRoot = await makeTempProject('ken-spec-sync-idempotent');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    const generatorPathFirst = await fs.readFile(
      path.join(projectRoot, '.claude', 'skills', 'ralph-loop', 'prompts', 'generator.md'),
      'utf8'
    );

    await syncProject(projectRoot);

    const generatorPathSecond = await fs.readFile(
      path.join(projectRoot, '.claude', 'skills', 'ralph-loop', 'prompts', 'generator.md'),
      'utf8'
    );

    expect(generatorPathFirst).toBe(generatorPathSecond);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/ralph-loop.test.ts`
Expected: FAIL — `syncProject` does not yet call `mirrorModuleAssets`.

- [ ] **Step 3: Implement `mirrorModuleAssets` and wire it in `src/commands/sync.ts`**

Replace the entire content of `src/commands/sync.ts` with:

```ts
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadConfig } from '../config.js';
import { ensureDir, readTextOrEmpty, writeText } from '../fs.js';
import { updateManagedBlock } from '../markers.js';
import { loadSkills, renderRootManagedBlock, renderSkillFile } from '../render.js';

const ASSET_SUBDIRS = ['prompts', 'rubrics', 'references', 'templates'] as const;

export async function syncProject(projectRoot: string): Promise<void> {
  const config = await loadConfig(projectRoot);
  const skills = await loadSkills(projectRoot);

  if (config.codex.enabled) {
    await syncSkillsToTool(projectRoot, '.codex', skills);
  }

  if (config.claude.enabled) {
    await syncSkillsToTool(projectRoot, '.claude', skills);
  }

  const block = renderRootManagedBlock();

  if (config.injectAgentsMd) {
    await syncManagedRootFile(path.join(projectRoot, 'AGENTS.md'), block);
  }

  if (config.injectClaudeMd) {
    await syncManagedRootFile(path.join(projectRoot, 'CLAUDE.md'), block);
  }
}

async function syncSkillsToTool(
  projectRoot: string,
  toolDir: string,
  skills: Array<{ name: string; content: string; sourceDir?: string }>
): Promise<void> {
  for (const skill of skills) {
    const skillOutputDir = path.join(projectRoot, toolDir, 'skills', skill.name);
    const targetPath = path.join(skillOutputDir, 'SKILL.md');
    await writeText(targetPath, renderSkillFile(skill));

    if (skill.sourceDir !== undefined) {
      await mirrorModuleAssets(skill.sourceDir, skillOutputDir);
    }
  }
}

/**
 * For each whitelisted asset subdir present under moduleSrcDir, remove the
 * corresponding subdir at moduleDstDir then recursively copy from source.
 * Excluded: `data/` and the module's `README.md`.
 */
async function mirrorModuleAssets(
  moduleSrcDir: string,
  moduleDstDir: string
): Promise<void> {
  for (const assetDir of ASSET_SUBDIRS) {
    const srcDir = path.join(moduleSrcDir, assetDir);
    const dstDir = path.join(moduleDstDir, assetDir);

    // Check source exists
    try {
      await fs.access(srcDir);
    } catch {
      // Source subdir doesn't exist — no-op for this subdir
      continue;
    }

    // Clean destination
    try {
      await fs.rm(dstDir, { recursive: true, force: true });
    } catch {
      // Destination didn't exist — fine
    }

    // Ensure destination parent exists and copy
    await ensureDir(moduleDstDir);
    await fs.cp(srcDir, dstDir, { recursive: true });
  }
}

async function syncManagedRootFile(filePath: string, block: string): Promise<void> {
  const existing = await readTextOrEmpty(filePath);
  await writeText(filePath, updateManagedBlock(existing, block));
}
```

- [ ] **Step 4: Run the ralph-loop tests to verify they pass**

Run: `npx vitest run test/ralph-loop.test.ts`
Expected: all tests in the `syncProject — ralph-loop asset mirroring` describe block PASS.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all existing tests pass. In particular `test/sync-command.test.ts`, `test/init-command.test.ts`, `test/doctor-command.test.ts`, and `test/clean-command.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/commands/sync.ts test/ralph-loop.test.ts
git commit -m "feat(sync): mirror module asset subdirs (prompts/rubrics/references/templates)"
```

---

### Task 4: Scaffold ralph-loop in `init.ts`

**Files:**
- Modify: `src/commands/init.ts`

This task wires all 13 template helpers into `initProject` so `ken-spec init` creates the full module source tree including the `data/ralph-loop/runs/.gitkeep`.

Depends on Task 1 (template helpers must exist). Does not depend on Tasks 2 or 3.

- [ ] **Step 1: Write the failing init test (append to `test/ralph-loop.test.ts`)**

```ts
describe('initProject — ralph-loop scaffolding', () => {
  it('creates all ralph-loop source files', async () => {
    const projectRoot = await makeTempProject('ken-spec-init-ralph');
    await initProject(projectRoot);

    const expectedPaths = [
      '.ken_spec/modules/ralph-loop/README.md',
      '.ken_spec/modules/ralph-loop/skill.md',
      '.ken_spec/modules/ralph-loop/prompts/generator.md',
      '.ken_spec/modules/ralph-loop/prompts/evaluator.md',
      '.ken_spec/modules/ralph-loop/prompts/assembler.md',
      '.ken_spec/modules/ralph-loop/rubrics/README.md',
      '.ken_spec/modules/ralph-loop/rubrics/one-pager.yaml',
      '.ken_spec/modules/ralph-loop/rubrics/assembly.yaml',
      '.ken_spec/modules/ralph-loop/references/host-profiles.md',
      '.ken_spec/modules/ralph-loop/references/decomposition-heuristics.md',
      '.ken_spec/modules/ralph-loop/references/iteration-log-schema.md',
      '.ken_spec/modules/ralph-loop/templates/task-spec.md',
      '.ken_spec/modules/ralph-loop/templates/run-dir-readme.md',
      '.ken_spec/data/ralph-loop/runs/.gitkeep',
    ];

    for (const relativePath of expectedPaths) {
      const targetPath = path.join(projectRoot, relativePath);
      await expect(fs.access(targetPath)).resolves.toBeUndefined();
    }
  });

  it('scaffolded skill.md and prompt files are non-empty', async () => {
    const projectRoot = await makeTempProject('ken-spec-init-ralph-nonempty');
    await initProject(projectRoot);

    const filesToCheck = [
      '.ken_spec/modules/ralph-loop/skill.md',
      '.ken_spec/modules/ralph-loop/prompts/generator.md',
      '.ken_spec/modules/ralph-loop/prompts/evaluator.md',
      '.ken_spec/modules/ralph-loop/prompts/assembler.md',
    ];

    for (const relativePath of filesToCheck) {
      const content = await fs.readFile(path.join(projectRoot, relativePath), 'utf8');
      expect(content.trim().length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/ralph-loop.test.ts`
Expected: FAIL — `initProject` does not yet create `modules/ralph-loop/` or `data/ralph-loop/`.

- [ ] **Step 3: Update `src/commands/init.ts` — add imports**

At the top of `src/commands/init.ts`, extend the named import from `../templates.js` to include all 13 new helpers (keep alphabetical order):

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
  getDefaultRalphLoopAssemblerPrompt,
  getDefaultRalphLoopAssemblyRubric,
  getDefaultRalphLoopDecomposeHeuristics,
  getDefaultRalphLoopEvaluatorPrompt,
  getDefaultRalphLoopGeneratorPrompt,
  getDefaultRalphLoopHostProfiles,
  getDefaultRalphLoopIterationLogSchema,
  getDefaultRalphLoopModuleReadme,
  getDefaultRalphLoopOnePagerRubric,
  getDefaultRalphLoopRunDirReadmeTemplate,
  getDefaultRalphLoopRubricsReadme,
  getDefaultRalphLoopSkill,
  getDefaultRalphLoopTaskSpecTemplate,
  getDefaultReadme,
  getDefaultRule,
  getDefaultSkill,
  getDefaultStyleReviewModuleReadme,
  getDefaultStyleReviewSkill,
} from '../templates.js';
```

- [ ] **Step 4: Update `src/commands/init.ts` — add `ensureDir` calls**

In the first `await Promise.all([...])` block, append new `ensureDir` calls:

```ts
  await Promise.all([
    ensureDir(path.join(root, 'rules')),
    ensureDir(path.join(root, 'skills')),
    ensureDir(path.join(root, 'commands')),
    ensureDir(path.join(root, 'modules', 'postmortem', 'templates')),
    ensureDir(path.join(root, 'modules', 'style-review')),
    ensureDir(path.join(root, 'modules', 'commit-prep')),
    ensureDir(path.join(root, 'modules', 'ralph-loop', 'prompts')),
    ensureDir(path.join(root, 'modules', 'ralph-loop', 'rubrics')),
    ensureDir(path.join(root, 'modules', 'ralph-loop', 'references')),
    ensureDir(path.join(root, 'modules', 'ralph-loop', 'templates')),
    ensureDir(path.join(root, 'data', 'postmortem', 'cases')),
    ensureDir(path.join(root, 'data', 'postmortem', 'retrospectives')),
    ensureDir(path.join(root, 'data', 'postmortem', 'derived-skills')),
    ensureDir(path.join(root, 'data', 'ralph-loop', 'runs')),
  ]);
```

- [ ] **Step 5: Update `src/commands/init.ts` — add `writeFileIfMissing` calls**

In the second `await Promise.all([...])` block, append the 14 new entries after the existing `commit-prep` lines:

```ts
    // ralph-loop module
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'README.md'), getDefaultRalphLoopModuleReadme()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'skill.md'), getDefaultRalphLoopSkill()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'prompts', 'generator.md'), getDefaultRalphLoopGeneratorPrompt()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'prompts', 'evaluator.md'), getDefaultRalphLoopEvaluatorPrompt()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'prompts', 'assembler.md'), getDefaultRalphLoopAssemblerPrompt()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'rubrics', 'README.md'), getDefaultRalphLoopRubricsReadme()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'rubrics', 'one-pager.yaml'), getDefaultRalphLoopOnePagerRubric()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'rubrics', 'assembly.yaml'), getDefaultRalphLoopAssemblyRubric()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'references', 'host-profiles.md'), getDefaultRalphLoopHostProfiles()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'references', 'decomposition-heuristics.md'), getDefaultRalphLoopDecomposeHeuristics()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'references', 'iteration-log-schema.md'), getDefaultRalphLoopIterationLogSchema()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'templates', 'task-spec.md'), getDefaultRalphLoopTaskSpecTemplate()),
    writeFileIfMissing(path.join(root, 'modules', 'ralph-loop', 'templates', 'run-dir-readme.md'), getDefaultRalphLoopRunDirReadmeTemplate()),
    // data/ralph-loop placeholder
    writeFileIfMissing(path.join(root, 'data', 'ralph-loop', 'runs', '.gitkeep'), ''),
```

- [ ] **Step 6: Run the ralph-loop init tests**

Run: `npx vitest run test/ralph-loop.test.ts`
Expected: all tests in `initProject — ralph-loop scaffolding` PASS.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all tests pass, including the existing `test/init-command.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/commands/init.ts test/ralph-loop.test.ts
git commit -m "feat(init): scaffold ralph-loop module and data/ralph-loop/runs/.gitkeep"
```

---

### Task 5: Add doctor check for ralph-loop asset subdirs

**Files:**
- Modify: `src/commands/doctor.ts`

Adds one new check: for each enabled tool's `ralph-loop` skill dir, verify all four asset subdirs (`prompts`, `rubrics`, `references`, `templates`) exist and are non-empty. Emits a `warn` finding per missing or empty subdir.

Depends on Task 4 (init must scaffold the assets so a clean init+sync path can pass doctor).

- [ ] **Step 1: Write the failing doctor tests (append to `test/ralph-loop.test.ts`)**

```ts
import { runDoctor } from '../src/commands/doctor.js';

describe('runDoctor — ralph-loop asset checks', () => {
  it('passes after clean init + sync', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-ralph-clean');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    const report = await runDoctor(projectRoot);
    const ralphWarnings = report.findings.filter(
      (f) => f.severity === 'warn' && f.message.includes('ralph-loop')
    );
    expect(ralphWarnings).toHaveLength(0);
  });

  it('warns when a ralph-loop asset subdir is missing from claude skills', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-ralph-missing');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    // Manually delete the prompts subdir from the claude skills output
    await fs.rm(
      path.join(projectRoot, '.claude', 'skills', 'ralph-loop', 'prompts'),
      { recursive: true, force: true }
    );

    const report = await runDoctor(projectRoot);
    const warnings = report.findings.filter((f) => f.severity === 'warn');
    expect(
      warnings.some(
        (f) => f.message.includes('ralph-loop') && f.message.includes('prompts')
      )
    ).toBe(true);
  });

  it('warns when a ralph-loop asset subdir exists but is empty', async () => {
    const projectRoot = await makeTempProject('ken-spec-doctor-ralph-empty');
    await initProject(projectRoot);
    await syncProject(projectRoot);

    // Empty the rubrics subdir in codex skills
    const rubricsDir = path.join(projectRoot, '.codex', 'skills', 'ralph-loop', 'rubrics');
    const entries = await fs.readdir(rubricsDir);
    await Promise.all(entries.map((e) => fs.rm(path.join(rubricsDir, e))));

    const report = await runDoctor(projectRoot);
    const warnings = report.findings.filter((f) => f.severity === 'warn');
    expect(
      warnings.some(
        (f) => f.message.includes('ralph-loop') && f.message.includes('rubrics')
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/ralph-loop.test.ts`
Expected: FAIL — `runDoctor` does not yet check ralph-loop asset subdirs.

- [ ] **Step 3: Add the ralph-loop asset check to `src/commands/doctor.ts`**

Just before the final `return finalize(findings);` in `runDoctor`, append:

```ts
  // Ralph Loop: verify asset subdirs are present and non-empty in each tool's skill dir.
  const ralphAssetDirs = ['prompts', 'rubrics', 'references', 'templates'] as const;
  for (const target of targets) {
    if (!target.enabled) continue;
    for (const assetDir of ralphAssetDirs) {
      const dirPath = path.join(
        projectRoot,
        target.toolDir,
        'skills',
        'ralph-loop',
        assetDir
      );
      let entries: string[] = [];
      try {
        entries = await fs.readdir(dirPath);
      } catch {
        findings.push({
          severity: 'warn',
          message: `ralph-loop asset subdir missing in ${target.label}: ${assetDir}/ — run \`ken-spec sync\``,
        });
        continue;
      }
      if (entries.length === 0) {
        findings.push({
          severity: 'warn',
          message: `ralph-loop asset subdir is empty in ${target.label}: ${assetDir}/ — run \`ken-spec sync\``,
        });
      }
    }
  }
```

Also add an import for `fs` at the top of `doctor.ts` if not already present — it already imports `{ promises as fs } from 'node:fs'`, so no change needed there.

- [ ] **Step 4: Run the ralph-loop doctor tests**

Run: `npx vitest run test/ralph-loop.test.ts`
Expected: all tests in `runDoctor — ralph-loop asset checks` PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass. The existing `'after init + sync, reports no errors or warnings'` case in `test/doctor-command.test.ts` must still pass (the clean path has all four asset subdirs populated by `syncProject`).

- [ ] **Step 6: Commit**

```bash
git add src/commands/doctor.ts test/ralph-loop.test.ts
git commit -m "feat(doctor): warn on missing or empty ralph-loop asset subdirs"
```

---

### Task 6: Validate built-in rubric YAML

**Files:**
- Modify: `test/ralph-loop.test.ts` (append)

The spec requires a test that parses `one-pager.yaml` and `assembly.yaml` from the scaffolded tree and asserts all required fields: `threshold`, `max_rounds`, `criteria` non-empty, every criterion's `evaluator` exists in `personas`, and weights sum to 1.0.

This task depends on Task 4 (init must create the YAML files) and is independent of Tasks 3 and 5.

- [ ] **Step 1: Write the rubric validation tests (append to `test/ralph-loop.test.ts`)**

Add at the top of the file:

```ts
import { parse } from 'yaml';
```

Then append the new describe block:

```ts
describe('built-in rubric YAML validity', () => {
  async function loadRubric(projectRoot: string, name: string): Promise<Record<string, unknown>> {
    const content = await fs.readFile(
      path.join(projectRoot, '.ken_spec', 'modules', 'ralph-loop', 'rubrics', `${name}.yaml`),
      'utf8'
    );
    return parse(content) as Record<string, unknown>;
  }

  function validateRubric(rubric: Record<string, unknown>, rubricName: string): void {
    expect(rubric.threshold, `${rubricName}: threshold`).toBeTypeOf('number');
    expect((rubric.threshold as number) > 0, `${rubricName}: threshold > 0`).toBe(true);

    expect(rubric.max_rounds, `${rubricName}: max_rounds`).toBeTypeOf('number');
    expect((rubric.max_rounds as number) > 0, `${rubricName}: max_rounds > 0`).toBe(true);

    const earlyStop = rubric.early_stop as Record<string, unknown>;
    expect(earlyStop?.no_improve_rounds, `${rubricName}: no_improve_rounds`).toBeTypeOf('number');
    expect((earlyStop.no_improve_rounds as number) > 0, `${rubricName}: no_improve_rounds > 0`).toBe(true);

    const criteria = rubric.criteria as Array<Record<string, unknown>>;
    expect(criteria.length, `${rubricName}: at least one criterion`).toBeGreaterThan(0);

    const personas = rubric.personas as Record<string, unknown>;
    expect(personas, `${rubricName}: personas must exist`).toBeDefined();

    let weightSum = 0;
    for (const criterion of criteria) {
      const evaluatorKey = criterion.evaluator as string;
      expect(
        personas[evaluatorKey],
        `${rubricName}: criterion ${criterion.id as string} evaluator "${evaluatorKey}" must exist in personas`
      ).toBeDefined();
      weightSum += criterion.weight as number;
    }

    expect(
      Math.abs(weightSum - 1.0) <= 0.01,
      `${rubricName}: weights must sum to 1.0 ± 0.01 (got ${weightSum})`
    ).toBe(true);
  }

  it('one-pager.yaml passes all validation rules', async () => {
    const projectRoot = await makeTempProject('ken-spec-rubric-one-pager');
    await initProject(projectRoot);
    const rubric = await loadRubric(projectRoot, 'one-pager');
    validateRubric(rubric, 'one-pager');
  });

  it('assembly.yaml passes all validation rules', async () => {
    const projectRoot = await makeTempProject('ken-spec-rubric-assembly');
    await initProject(projectRoot);
    const rubric = await loadRubric(projectRoot, 'assembly');
    validateRubric(rubric, 'assembly');
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run test/ralph-loop.test.ts`
Expected: all tests in `built-in rubric YAML validity` PASS (the YAML was authored correctly in Task 1).

If either test fails, go back to `src/templates.ts` and fix the corresponding `getDefaultRalphLoopOnePagerRubric()` or `getDefaultRalphLoopAssemblyRubric()` function, then rebuild.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add test/ralph-loop.test.ts
git commit -m "test: validate built-in one-pager and assembly rubric YAML"
```

---

### Task 7: Final full-suite verification

**Files:**
- (none — verification only)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: exits 0 with no TypeScript errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: every test passes across `test/init-command.test.ts`, `test/sync-command.test.ts`, `test/clean-command.test.ts`, `test/doctor-command.test.ts`, `test/markers.test.ts`, `test/smoke.test.ts`, and `test/ralph-loop.test.ts`.

- [ ] **Step 3: Smoke-test the CLI end-to-end against a scratch project**

```bash
SCRATCH=/tmp/ken-spec-ralph-e2e
rm -rf "$SCRATCH" && mkdir -p "$SCRATCH"
node /Users/wenbokang/projects/ken-spec/dist/bin.js --help
cd "$SCRATCH"
node /Users/wenbokang/projects/ken-spec/dist/bin.js init
node /Users/wenbokang/projects/ken-spec/dist/bin.js sync
node /Users/wenbokang/projects/ken-spec/dist/bin.js doctor
```

Expected:
- `.ken_spec/modules/ralph-loop/` contains `skill.md`, `prompts/`, `rubrics/`, `references/`, `templates/`
- `.ken_spec/data/ralph-loop/runs/.gitkeep` exists
- `.claude/skills/ralph-loop/SKILL.md` exists
- `.claude/skills/ralph-loop/prompts/generator.md` exists (and matches source)
- `.claude/skills/ralph-loop/rubrics/one-pager.yaml` exists
- `.codex/skills/ralph-loop/references/host-profiles.md` exists
- `doctor` reports `0 error(s), 0 warning(s)` (info findings from default empty rule sections are OK)

- [ ] **Step 4: Confirm branch is clean**

Run: `git status`
Expected: working tree clean. `git log --oneline` shows commits from Tasks 1 through 6.
