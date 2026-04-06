# Auto Prompt Creator — Methodology v2

The anneal loop optimizes prompts for cheap models (Haiku) to match expensive model (Opus) quality on defined tasks. This document codifies the rules that prevent the optimizer from gaming its own test set.

## Core Principle

**Teach the model to reason, not to memorize.** A prompt full of worked examples that map 1:1 to the test set will score well on eval and fail in production. The goal is generalizable reasoning instructions, not a lookup table.

## Workflow Phases

### Phase 1: Setup (Human-Driven)

1. **Define inputs and outputs.** Human specifies the input schema (what goes in), output schema (what comes out), and rubric dimensions with weights.
2. **Create scenario.json.** Rubric, accuracy threshold (default 0.92), token budget (default 800), max iterations (default 10).
3. **Provide input examples.** Minimum 9. Human selects or curates these.
4. **Generate ground truth.** Opus generates reference outputs for each input. Human validates and corrects. This is the quality bar — it must be right.
5. **Split data.** Train (60%) / Validation (30%) / Holdout (10%). Holdout is never seen during the loop — only scored at graduation.

### Phase 2: Baseline (Human-Supervised)

1. Human writes or provides v001 baseline prompt.
2. Execute v001 against all train+val inputs.
3. Score outputs. **Show the raw output table to the human** — company, output, ground truth side by side.
4. Human reviews outputs, provides feedback, course-corrects.
5. Human says "go iterate" to kick off autonomous mode.

### Phase 3: Autonomous Loop

Runs iterations until a halt condition triggers. Each iteration:

1. **Analyze failures** from previous version (structured failure patterns with frequency and severity).
2. **Select mutation type** subject to diversity constraints (see below).
3. **Generate mutated prompt** targeting the priority failure pattern.
4. **Execute** against all train+val inputs.
5. **Score** outputs against ground truth.
6. **Update loop-state.json** with scores, mutation type, halt check.
7. **Print iteration summary** with raw output table (always visible).

### Phase 4: Graduation

1. Score best version against **holdout set** (never seen during loop).
2. If holdout score >= threshold: graduate to `library/` with full metadata.
3. If holdout score < threshold by >0.10: the prompt memorized the eval set. Flag as overfitted, do not graduate.
4. Report holdout vs val gap as a generalization metric.

## Mutation Diversity Constraints

These rules prevent the optimizer from falling into the "just add another example" trap.

### The Three Mutation Phases

| Loop Phase | Iterations | Allowed Mutations | Purpose |
|---|---|---|---|
| **Bootstrap** | 1-3 | All types, examples encouraged | Teach the model the basic pattern |
| **Generalize** | 4-7 | Structural only, examples blocked | Force reasoning improvements |
| **Polish** | 8-10 | All types, subtractive encouraged | Tighten, compress, remove noise |

### Mutation Types

| Type | What It Does | When to Use |
|---|---|---|
| **additive** | Add new instructions, rules, or examples | Bootstrap phase; sparingly after |
| **structural** | Reframe the prompt's reasoning approach | Generalize phase; any time reasoning is weak |
| **targeted** | Fix one specific failure pattern | Any phase, but NOT via examples in generalize phase |
| **consolidation** | Merge redundant instructions, tighten wording | Polish phase; when token budget is tight |
| **subtractive** | Remove instructions/examples and check if score holds | Polish phase; validation of generalization |

### Hard Rules

1. **Example cap: 4 per concept.** Beyond 4 worked examples for any single concept (e.g., budget-holder mapping), the prompt is building a lookup table. Stop adding examples and switch to structural reasoning instructions.

2. **No 2 consecutive example-heavy mutations.** If the previous mutation was primarily adding examples, the next must be structural, consolidation, or subtractive.

3. **Generalize phase (iterations 4-7): examples are blocked.** Mutations must improve reasoning instructions, reframe the task, add constraints, or restructure the prompt. If an example-based fix is the only way to address a failure, the reasoning instructions are inadequate — fix those instead.

4. **Mandatory subtractive check at iteration 8.** Before the polish phase, run a subtractive experiment: remove 50% of worked examples and re-score. If the score drops < 0.05, the reasoning instructions are carrying the weight (good). If it drops > 0.10, the examples are doing the work (bad — go back to generalize).

5. **Mutation type logged in loop-state.json.** Every iteration records its mutation type. The autonomous loop must check the log before selecting the next mutation.

### Structural Mutation Examples

When examples are blocked, these are the levers:

- **Reframe the task.** Change "identify X" to "reason about X then output."
- **Add constraints.** Word limits, format rules, forbidden patterns.
- **Add negative instructions.** "Do NOT do X" is often more powerful than examples of doing Y.
- **Change reasoning order.** Move the reasoning step before/after specific instructions.
- **Add self-check instructions.** "Before outputting, verify that [condition]."
- **Generalize from examples.** Replace 4 specific examples with 1 abstract rule that covers all 4 cases. This is the inverse of adding examples.
- **Mirror/echo rules.** "Use the input's exact terminology" rather than specific "if X then Y" mappings.

## Halt Conditions

Checked after every iteration, in order:

| Condition | Trigger | Halt Reason |
|---|---|---|
| **Threshold reached** | val >= accuracy_threshold | `threshold-reached` |
| **Max iterations** | iteration >= max_iterations | `max-iterations` |
| **Convergence plateau** | 3 consecutive val deltas < 0.02 | `convergence-plateau` |
| **Overfitting** | train-val gap > overfitting_threshold | `overfitting` |
| **Token budget** | prompt tokens > token_budget | `token-budget` |

## Data Split Rules

| Split | Size | Purpose | When Scored |
|---|---|---|---|
| **Train** | ~60% | Mutation feedback — failures here drive changes | Every iteration |
| **Validation** | ~30% | Generalization signal — not used to design mutations | Every iteration |
| **Holdout** | ~10% | Final generalization check — never seen during loop | Graduation only |

**Minimum dataset sizes:**
- 12 examples minimum (7 train, 3 val, 2 holdout)
- 15+ recommended for stable signals
- Val and holdout must contain at least 1 "hard" example that doesn't map to any worked example in the prompt

## Generalization Metrics (Graduation Report)

At graduation, report:

| Metric | Formula | Healthy Range |
|---|---|---|
| **Val-Train Gap** | val - train | -0.05 to +0.05 |
| **Holdout-Val Gap** | holdout - val | > -0.08 |
| **Example Density** | worked examples / prompt tokens | < 0.01 |
| **Structural Ratio** | structural mutations / total mutations | > 0.40 |

If holdout-val gap < -0.10, the prompt is overfitted to the eval set. Do not graduate.

## Output Visibility

**Every iteration must show the raw output table.** The human (or the session log) needs to see what the model actually produced, not just aggregate scores. Format:

```
| Company | Output | Ground Truth | Score |
```

This enables course correction and catches failure patterns that aggregate scores hide.

## Parameterization

**One runner, one scorer.** No copy-paste per version.

- Runner: `bun run-eval.mjs --scenario [name] --version vNNN`
- Scorer: `python compute-scores.py --scenario [name] --version vNNN`
- Or: automated judge via Claude CLI / API call (preferred when available)

Version-specific scripts are tech debt. Parameterize from day one.
