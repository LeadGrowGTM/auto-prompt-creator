# Phase 2: Execution + Evaluation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 02-Execution + Evaluation
**Areas discussed:** Agent Spawning, Judge Prompt Structure, Iteration File Format, Scoring Aggregation
**Mode:** --auto (all areas auto-selected, recommended defaults chosen)

---

## Agent Spawning

| Option | Description | Selected |
|--------|-------------|----------|
| CC Agent tool with model='haiku' and inline prompt | Simplest approach, no extra files, matches CC-as-runtime constraint | x |
| Separate skill file for Haiku execution | More structure but unnecessary indirection for v1 | |
| Custom script wrapper | Violates CC-only constraint | |

**User's choice:** [auto] CC Agent tool with model='haiku' and inline prompt (recommended default)
**Notes:** Directly uses CC's built-in agent spawning. Candidate prompt passed as the agent's prompt parameter. One input per agent call.

---

## Judge Prompt Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Field-by-field with per-dimension rubric scores | Granular scoring, aligns with scenario.json rubric, gives failure signals for Phase 3 | x |
| Holistic single-score comparison | Simpler but hides which dimensions are failing | |
| Pairwise ranking (no ground truth reference) | Not applicable — we have ground truth | |

**User's choice:** [auto] Field-by-field comparison with per-dimension rubric scores (recommended default)
**Notes:** Maps directly to the 4-dimension rubric in scenario.json (accuracy 0.4, label_normalization 0.25, completeness 0.2, specificity 0.15). Judge scores each dimension 1-5 with rationale.

---

## Iteration File Format

| Option | Description | Selected |
|--------|-------------|----------|
| JSON files in evals/ directory | Consistent with scenario.json and ground truth format, structured for programmatic reads | x |
| YAML files in evals/ | Research recommended YAML but existing artifacts are JSON | |
| Single consolidated log file | Harder to query per-version, grows unwieldy | |

**User's choice:** [auto] JSON files in evals/ directory (recommended default)
**Notes:** Research STACK.md suggested YAML, but Phase 1 established JSON as the convention. Staying consistent. One eval file per prompt version.

---

## Scoring Aggregation

| Option | Description | Selected |
|--------|-------------|----------|
| Weighted average per input, mean across inputs | Directly maps to rubric weights, simple, interpretable | x |
| Geometric mean across inputs | Penalizes low outliers more, but less interpretable | |
| Median across inputs | Robust to outliers but loses information | |

**User's choice:** [auto] Weighted average across dimensions per input, then mean across all inputs (recommended default)
**Notes:** Per-input: sum(dimension_score * weight) / sum(weights), normalized to 0-1. Prompt-level: arithmetic mean of per-input scores. Train and validation computed separately.

---

## Claude's Discretion

- Exact Haiku agent prompt template structure
- Eval result JSON field names and schema
- Calibration anchor examples for judge prompt
- Whether to run train-only or train+validation per iteration (Phase 2 builds both capabilities)

## Deferred Ideas

None — all discussion stayed within phase scope.
