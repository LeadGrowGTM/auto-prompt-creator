---
name: anneal-loop
description: Run the prompt optimization anneal loop for any scenario. Analyzes failures, generates mutations subject to diversity constraints, executes prompts, judges outputs, and tracks state. Enforces METHODOLOGY.md rules to prevent example-overfitting. Use for any scenario under auto-prompt-creator/scenarios/.
---

# Anneal Loop

Optimizes a prompt for Haiku to match Opus-quality outputs on a defined task. Each iteration: analyze, mutate, execute, score, check halt. Enforces mutation diversity to prevent memorization.

**Before anything:** Read `auto-prompt-creator/METHODOLOGY.md` — it defines the mutation phase rules, diversity constraints, and generalization safeguards that govern this loop.

## Before You Start

1. Read `scenarios/{scenario}/evals/loop-state.json`
2. If `halt_reason` is not null: **STOP**. Report halt reason and best version.
3. Read `scenarios/{scenario}/scenario.json` for rubric, threshold, and config.
4. Note: `current_iteration`, `best_version`, `best_validation_score`
5. Determine current version: `"v" + String(current_iteration).padStart(3, "0")`
6. **Determine mutation phase:**
   - Iterations 1-3: Bootstrap (examples allowed)
   - Iterations 4-7: Generalize (examples blocked)
   - Iterations 8-10: Polish (subtractive encouraged)

## Step 1: Execute Current Prompt

If `evals/vNNN-raw.json` exists, skip.

```bash
bun scenarios/{scenario}/evals/run-eval.mjs --scenario {scenario} --version vNNN
```

Output: `evals/vNNN-raw.json`

## Step 2: Score Outputs

If `evals/vNNN.json` exists, skip.

```bash
python scenarios/{scenario}/evals/compute-scores.py --version vNNN
```

Output: `evals/vNNN.json` with per-input and aggregate scores.

## Step 3: Show Raw Output Table

**Non-negotiable.** Print the full output table before any analysis:

```
| Company | Split | Output | Ground Truth | Weighted Score |
```

This allows human course-correction. Never skip this step, even in autonomous mode.

## Step 4: Analyze Failures

For each input where weighted score < 0.80:
1. Identify the failing dimension(s)
2. Categorize the failure pattern (wrong_target, wrong_function, missing_qualifier, format_error, etc.)
3. Rank by frequency and severity
4. Identify the `priority_target` — the single pattern fix that would move the most score

Output: structured failure analysis held in memory.

## Step 5: Check Halt Conditions

Check in order. First match halts.

1. **Threshold reached:** val >= accuracy_threshold -> `threshold-reached`
2. **Max iterations:** iteration >= max_iterations -> `max-iterations`
3. **Convergence plateau:** 3 consecutive val deltas < 0.02 -> `convergence-plateau`
4. **Overfitting:** |train - val| > overfitting_threshold -> `overfitting`
5. **Token budget:** tokens > token_budget -> `token-budget`

On halt: update loop-state.json, report, then run graduation (Step 10).
On continue: proceed to Step 6.

## Step 6: Select Mutation Type

**This step enforces METHODOLOGY.md diversity constraints.**

1. Read `last_mutation_type` from loop-state.json
2. Determine current phase (bootstrap / generalize / polish)
3. Apply constraints:

| Phase | Allowed | Blocked | Forced |
|---|---|---|---|
| Bootstrap (1-3) | All types | None | None |
| Generalize (4-7) | structural, targeted (no examples), consolidation, subtractive | additive examples | Structural if prev was example-heavy |
| Polish (8-10) | All types | None | Subtractive check at iteration 8 |

4. **Hard rule:** If the previous 2 mutations were both example-heavy, this one MUST be structural or subtractive. No exceptions.
5. **Example cap:** Count worked examples in the current prompt. If >= 4 per concept, no more examples for that concept.

Log the selected mutation type.

## Step 7: Generate Mutation

Based on the priority_target from Step 4 and the mutation type from Step 6:

**If structural (generalize phase):**
- Reframe reasoning instructions
- Add constraints or negative instructions
- Generalize existing examples into abstract rules
- Add self-check steps
- Do NOT add new worked examples

**If additive (bootstrap phase):**
- Add 1-2 worked examples targeting the priority failure
- Keep total examples per concept <= 4

**If subtractive (polish phase):**
- Remove 50% of worked examples
- Re-score. If drop < 0.05: reasoning is strong, keep the leaner prompt
- If drop > 0.10: reasoning is weak, revert and flag for structural improvement

**If consolidation:**
- Merge redundant instructions
- Replace multiple specific rules with one general rule
- Tighten wording, reduce token count

Write the new prompt: `evals/v[N+1].md`

## Step 8: Update State

Update `evals/loop-state.json`:
- `current_iteration` += 1
- Append to `score_history` (version, overall, train, val, tokens, mutation_type, timestamp)
- Update `best_version` / `best_validation_score` if val improved
- Set `last_mutation_type`
- Update `consecutive_plateaus`

## Step 9: Print Iteration Summary

```
## vNNN -> v[N+1] | [mutation_type] | Phase: [bootstrap/generalize/polish]

| Metric  | Previous | Current | Delta  |
|---------|----------|---------|--------|
| Overall | X.XXX    | X.XXX   | +X.XXX |
| Train   | X.XXX    | X.XXX   | +X.XXX |
| Val     | X.XXX    | X.XXX   | +X.XXX |
| Tokens  | NNN      | NNN     | +NN    |

Mutation: [description of what changed]
Rationale: [why this mutation, what failure it targets]
Next: [what the next iteration should focus on]
```

## Step 10: Graduate

Only on halt with `threshold-reached`:

1. Score best version against **holdout set** (inputs with split: "holdout").
2. Compute generalization metrics:
   - Val-Train Gap (healthy: -0.05 to +0.05)
   - Holdout-Val Gap (healthy: > -0.08)
   - Example Density (healthy: < 0.01 examples/token)
   - Structural Ratio (healthy: > 0.40)
3. If holdout-val gap < -0.10: **DO NOT GRADUATE.** Flag as overfitted.
4. Otherwise: write to `library/{scenario}.md` with YAML frontmatter.

```yaml
---
scenario: {name}
graduated: {date}
accuracy:
  overall: {score}
  train: {score}
  validation: {score}
  holdout: {score}
threshold: {threshold}
iterations: {count}
best_version: {vNNN}
target_model: haiku
test_set_size: {count}
tokens: {count}
generalization:
  val_train_gap: {gap}
  holdout_val_gap: {gap}
  example_density: {density}
  structural_ratio: {ratio}
---
```

## Halt Report Format

```
**Halt reason:** [reason]
**Best version:** [vNNN] with val score [X.XXX]
**Iterations:** [N]
**Mutation type distribution:** [N additive, N structural, N targeted, N consolidation, N subtractive]

| Version | Overall | Train | Val   | Tokens | Phase      | Mutation     |
|---------|---------|-------|-------|--------|------------|--------------|
| v001    | 0.XXX   | 0.XXX | 0.XXX | NNN    | bootstrap  | baseline     |
| ...     | ...     | ...   | ...   | ...    | ...        | ...          |

**Generalization check:** [holdout score] vs [val score] = [gap]
```
