# Phase 3: Mutation + Optimization Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 03-mutation-optimization-loop
**Areas discussed:** Failure Analysis Method, Mutation Strategy, Loop Orchestration, Convergence Rules
**Mode:** --auto (all defaults auto-selected)

---

## Failure Analysis Method

| Option | Description | Selected |
|--------|-------------|----------|
| Per-input diff only | Opus compares each failing input against ground truth individually | |
| Per-input diff + aggregate pattern clustering | Per-input analysis PLUS cross-input pattern detection with named taxonomy | ✓ |
| Statistical dimension analysis | Focus on dimension-level aggregates without per-input detail | |

**User's choice:** [auto] Per-input diff + aggregate pattern clustering (recommended default)
**Notes:** Both granular per-input diffs (for targeted mutations) and aggregate patterns (for systematic fixes) needed. Phase 2 already identified "strong-fit bias" as the dominant pattern.

---

## Mutation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Additive rules only | Only append new rules, never modify existing prompt | |
| Targeted additive first, rewrite if plateaued | Add rules initially, switch to consolidation when additive stalls | ✓ |
| Full rewrite each iteration | Opus rewrites entire prompt each time | |

**User's choice:** [auto] Targeted additive first, rewrite if plateaued (recommended default)
**Notes:** Additive preserves completeness (0.972) while targeting accuracy (0.472). Full rewrites risk regressing working dimensions. Consolidation pass as escape hatch for plateau.

---

## Loop Orchestration

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone .mjs script | Fully automated script that runs all iterations | |
| CC skill methodology | Opus orchestrates each iteration in-session, spawns Haiku agents | ✓ |
| Hybrid (script + manual checkpoints) | Script runs 3 iterations, pauses for human review | |

**User's choice:** [auto] CC skill methodology (recommended default)
**Notes:** Aligns with project constraint (CC sessions only, no external API). Opus has full context to make intelligent mutation decisions. Script pattern from run-v001.mjs reusable for the execution step within each iteration.

---

## Convergence Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Simple max-iterations only | Run all 15 iterations, pick best | |
| 3-iteration plateau halt + best-version rollback | Halt on plateau, overfitting, or token exhaustion; report best version | ✓ |
| Adaptive threshold relaxation | If not converging, lower the target | |

**User's choice:** [auto] 3-iteration plateau halt + best-version rollback (recommended default)
**Notes:** Multiple halt conditions prevent waste: plateau (delta < 0.02 for 3 iterations), overfitting (train-val gap > 8%), token budget exhaustion. Always report best validation score version as graduation candidate.

---

## Claude's Discretion

- Failure analysis prompt structure
- Mutation instruction format (vN → vN+1)
- Whether to reuse run-v001.mjs literally or rewrite
- Semantic drift detection calibration

## Deferred Ideas

None — discussion stayed within phase scope
