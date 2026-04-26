# Ralph Loop Generic Artifact Workflow

**Date:** 2026-04-26
**Status:** Approved for implementation planning
**Rollback marker:** branch `codex-pre-ralph-loop-generic` at `63479fa`

## Goal

Complete Ralph Loop as a generic host-driven workflow for improving artifacts through collaborating agent roles. The existing document-focused v1 becomes the first artifact adapter, not the definition of the whole system.

Ralph Loop should support document generation, code implementation, refactors, design-to-code work, and decision/analysis tasks through the same core loop:

1. Orchestrator classifies the task and owns run state.
2. Planner turns the request into an executable task spec and split proposal.
3. Generator produces the next artifact candidate.
4. Evaluator scores the candidate with rubric-bound feedback.
5. Assembler reconciles split outputs when decomposition was used.

## Non-Goals

- Building a standalone LLM runtime or new CLI runner. Execution remains inside Claude Code or Codex.
- Making every task equally automated. Code tasks default to conservative plan/patch mode.
- Removing document workflows. Existing one-pager, PRD, RFC, and brief flows must remain compatible.
- Guaranteeing that subagents can safely edit the same files in parallel. Direct code implementation mode requires explicit user permission and disjoint write ownership.

## Core Concepts

### Core Loop

The core loop is artifact-agnostic. It only requires:

- a task spec
- an adapter selection
- a rubric
- a current best artifact or empty baseline
- evaluator feedback
- stop conditions

The Orchestrator persists state under `.ken_spec/data/ralph-loop/runs/<run-id>/` and never relies on working memory as the only source of truth.

### Roles

| Role | Responsibility |
|---|---|
| Orchestrator | Detect host, classify task, select adapter/rubric, manage files, dispatch subagents, aggregate scores, decide when to stop |
| Planner | Convert the request into a task spec, identify constraints, propose decomposition, and define execution mode |
| Generator | Produce the next artifact candidate from the plan, current best, feedback, and regression notes |
| Evaluator | Score assigned rubric criteria and return actionable feedback |
| Assembler | Merge split artifacts and fix cross-artifact consistency without inventing unverified work |

Planner can run inside the Orchestrator for simple tasks. For complex tasks, the Orchestrator may dispatch a Planner subagent before generation begins.

### Artifact Adapters

Adapters define artifact-specific behavior while sharing the same loop mechanics.

| Adapter | Use cases | Default output | Default rubric |
|---|---|---|---|
| `document` | one-pagers, PRDs, RFCs, briefs, long-form docs | Markdown document | `one-pager.yaml` or user-selected document rubric |
| `code` | code implementation, refactor, design-to-code | implementation plan + patch proposal; direct edits only with explicit permission | `code-implementation.yaml` |
| `decision` | architecture decisions, technical choices, tradeoff analysis | decision memo or recommendation | future `decision.yaml`; v1 may require user-provided rubric |

Unknown tasks should not be rejected just because they are not documents. The Orchestrator should classify them, choose the closest adapter, or ask the user for a rubric when no default exists.

## Code Adapter

Code tasks use two execution modes.

### Plan/Patch Mode

This is the default for `code implementation`, `refactor`, and `design-to-code`.

The loop produces and refines:

- implementation plan
- affected files and ownership assumptions
- patch proposal or diff guidance
- test strategy
- risk notes
- open questions or blockers

After the loop converges, the main agent applies the best plan, edits files, and runs verification. Evaluator subagents do not claim tests have passed unless they have actual command output.

### Direct Implementation Mode

This mode is allowed only when the user explicitly permits Ralph Loop subagents to edit code.

Rules:

- Each worker owns a disjoint file or module scope.
- Workers must not revert or overwrite unrelated changes.
- Workers must adapt to other in-progress edits.
- The Orchestrator integrates outputs, resolves conflicts, and runs verification.
- If ownership cannot be separated cleanly, fall back to plan/patch mode.

## Code Rubric

Add `rubrics/code-implementation.yaml` with weighted criteria:

- `correctness`: satisfies the requested behavior and handles important edge cases
- `integration_fit`: matches existing architecture, APIs, conventions, and data flow
- `test_strategy`: proposes or includes focused tests for the riskiest behavior
- `maintainability`: keeps the solution readable, scoped, and not over-abstracted
- `safety_risk`: identifies migration, compatibility, concurrency, data-loss, and rollback risks

The rubric should use the existing 0-100 scoring convention and persona routing.

## Skill Behavior Changes

`skill.md` should describe Ralph Loop as a generic artifact workflow. Its trigger should include:

- generating, refining, or improving any structured artifact
- code implementation, refactor, design-to-code, or implementation planning
- decision or analysis tasks that benefit from Planner/Generator/Evaluator collaboration

The pre-flight self-check should add:

```text
Task type:        <document | code | decision | unknown>
Selected adapter: <adapter name>
Execution mode:   <plan-patch | direct-implementation | document | decision>
Rubric:           <path>
Planner:          <in-session | subagent>
```

For code tasks, the self-check must state that plan/patch mode is the default and direct implementation requires explicit user permission.

## Prompt Changes

The current generator/evaluator/assembler prompts are document-specific. They should be rewritten so they accept adapter instructions:

- Generator receives the selected adapter, execution mode, task spec, current best artifact, feedback, and regression note.
- Evaluator receives adapter-specific scoring instructions and must score only assigned criteria.
- Assembler receives adapter-specific merge rules. For code, it merges plans or patch proposals unless direct implementation mode was explicitly chosen.

Document behavior remains supported by passing document adapter instructions.

## File Layout Changes

Add:

```text
.ken_spec/modules/ralph-loop/references/artifact-adapters.md
.ken_spec/modules/ralph-loop/rubrics/code-implementation.yaml
```

Keep existing files:

```text
.ken_spec/modules/ralph-loop/rubrics/one-pager.yaml
.ken_spec/modules/ralph-loop/rubrics/assembly.yaml
.ken_spec/modules/ralph-loop/prompts/generator.md
.ken_spec/modules/ralph-loop/prompts/evaluator.md
.ken_spec/modules/ralph-loop/prompts/assembler.md
```

No new runtime directory is needed beyond the existing runs tree.

## Compatibility

Existing projects that already ran `ken-spec init` will not be overwritten by `init`, because scaffolding uses `writeFileIfMissing`. They can receive the new module content by updating `.ken_spec/modules/ralph-loop/` manually or by using a future migration/re-init workflow.

Fresh `ken-spec init` should scaffold the generic Ralph Loop assets.

`ken-spec sync` continues to mirror `prompts`, `rubrics`, `references`, and `templates` into `.codex/skills/ralph-loop/` and `.claude/skills/ralph-loop/`.

## Doctor Checks

Existing Ralph Loop asset checks should remain. Add coverage that the scaffolded and synced assets include:

- `references/artifact-adapters.md`
- `rubrics/code-implementation.yaml`

Doctor should continue warning when expected Ralph Loop asset subdirs are missing or empty.

## Testing

Tests should verify:

- `initProject` creates the new reference and code rubric for fresh projects.
- `syncProject` mirrors the new files to both `.codex` and `.claude`.
- Rubric validation tests include `code-implementation.yaml`.
- Skill content no longer says Ralph Loop is only for long-form structured documents.
- Skill content includes code/refactor/design-to-code triggers and plan/patch default behavior.

## Rollback

Before this change, branch `codex-pre-ralph-loop-generic` was created at `63479fa`. If the generic direction proves wrong, reset or branch from that marker instead of manually undoing the whole series.
