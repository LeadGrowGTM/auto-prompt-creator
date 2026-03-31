---
name: icp-classification-anneal-loop
description: Run one iteration of the anneal loop for the icp-classification scenario. Analyzes failures from the previous eval, generates a targeted mutation, executes the new prompt against all 9 inputs, judges outputs, updates loop state, and commits. Call this skill at the start of each optimization session to advance the loop by one iteration.
---

# ICP Classification Anneal Loop

This skill runs one iteration of the prompt optimization loop. Each iteration: analyze failures, generate a mutation, execute the mutated prompt, judge outputs, update state, commit. Repeat until halt.

## Before You Start

1. Read `scenarios/icp-classification/evals/loop-state.json`
2. If `halt_reason` is not null: **STOP**. The loop is finished. Report the halt reason and best version.
3. Note these values:
   - `current_iteration` (the iteration you are about to score/analyze)
   - `consecutive_plateaus`
   - `best_version`
   - `best_validation_score`
4. Determine current version string: `"v" + String(current_iteration).padStart(3, "0")`
   - Example: current_iteration=1 means you are analyzing v001 results and will produce v002

## Step 1: Execute Current Prompt on All Inputs

If `evals/vNNN-raw.json` already exists for the current version (e.g., v001-raw.json exists when current_iteration=1), skip execution. The raw outputs are already available.

If not, run:

```bash
bun scenarios/icp-classification/evals/run-vNNN.mjs scenarios/icp-classification vNNN
```

- Output: `scenarios/icp-classification/evals/vNNN-raw.json`
- Note the `estimated_tokens` value from the script's console summary output

## Step 2: Judge All Outputs

If `evals/vNNN.json` already exists for the current version, skip judging. The scored results are already available.

If not, run compute-scores to score all outputs (3 Opus runs, median per dimension):

```bash
python scenarios/icp-classification/evals/compute-scores.py
```

Note: For each version, use the corresponding compute-scores script: `compute-scores-vNNN.py`. Create one for each new version by duplicating the previous version's script and updating the judge run data.

- Output: `scenarios/icp-classification/evals/vNNN.json` with aggregate and per-input scores

## Step 3: Analyze Failures

1. Read `.planning/phases/03-mutation-optimization-loop/prompts/failure-analysis-prompt.md`
2. Replace `{{EVAL_JSON}}` with the full contents of `scenarios/icp-classification/evals/vNNN.json`
3. Execute the combined text as your analysis task. Read the prompt as instructions and produce the `failure_analysis` JSON.
4. Hold the `failure_analysis` JSON result in memory for Step 6.

The output is a structured JSON with named failure patterns, frequencies, severities, and a `priority_target`.

## Step 4: Check Halt Conditions

Check these conditions in order. First match halts the loop.

1. **Success:** `vNNN.json` `aggregate.overall_score >= 0.92`
   - HALT with reason: `threshold-reached`

2. **Max iterations:** `loop-state.json` `current_iteration >= 15`
   - HALT with reason: `max-iterations`

3. **Convergence plateau:** Last 3 score deltas all < 0.02
   - Requires at least 4 entries in `score_history`
   - Delta = `|score_history[N].overall - score_history[N-1].overall|`
   - HALT with reason: `convergence-plateau`

4. **Overfitting:** `|train_score - validation_score| > 0.08`
   - Uses the current eval's aggregate train and validation scores
   - HALT with reason: `overfitting`

5. **Token budget:** `estimated_tokens` from Step 1 > 800
   - HALT with reason: `token-budget-exhausted`

**On halt:** Set `loop-state.json` `halt_reason` to the halt string. Find `best_version` (score_history entry with highest `val`). Report using the Halt Report Format at the bottom of this skill. Then run Step 9: Graduate to Library.

**On continue:** Proceed to Step 5.

## Step 5: Semantic Drift Check (every 3 iterations)

Only run when `current_iteration` is divisible by 3 (iterations 3, 6, 9, 12, 15).

1. Read `scenarios/icp-classification/scenario.json` description field
2. Read current prompt `scenarios/icp-classification/prompts/vNNN.md`
3. Assess: "Does this prompt still serve the same task described in scenario.json? Rate 1-5."
   - 5 = perfectly aligned
   - 3 = still serves the task but drifting
   - 1 = no longer serves the original task
4. If rating < 3: add `"semantic_drift_warning": true` to `loop-state.json`
5. Do NOT halt on drift. Flag and continue.

## Step 6: Generate Mutation

1. Read `.planning/phases/03-mutation-optimization-loop/prompts/mutation-instruction-prompt.md`
2. Replace placeholders:
   - `{{CURRENT_PROMPT}}` with contents of `scenarios/icp-classification/prompts/vNNN.md`
   - `{{FAILURE_ANALYSIS}}` with the failure analysis JSON from Step 3
   - `{{LOOP_STATE}}` with contents of `scenarios/icp-classification/evals/loop-state.json`
3. Execute the combined text as your mutation task. Follow the mutation instruction prompt to produce:
   - Complete new prompt text
   - Mutation log entry
4. Hold both outputs in memory for Step 7.

## Step 7: Write Iteration Artifacts

1. **Write new prompt:** `scenarios/icp-classification/prompts/v[N+1].md`
   - N+1 = current_iteration + 1, zero-padded to 3 digits (e.g., v002)
   - This is the complete new prompt from Step 6

2. **Append to mutations.log:** `scenarios/icp-classification/mutations.log`
   - Use the mutation log entry from Step 6
   - Fill in actual scores from Step 2 (replace any TBD values)

3. **Update loop-state.json:** `scenarios/icp-classification/evals/loop-state.json`
   - `current_iteration` += 1
   - `score_history`: append new entry:
     ```json
     {
       "version": "vNNN",
       "overall": [aggregate.overall_score from vNNN.json],
       "train": [aggregate.train_score],
       "val": [aggregate.validation_score],
       "tokens": [estimated_tokens from Step 1],
       "halt_checked": true,
       "timestamp": "[ISO 8601 UTC]"
     }
     ```
   - `best_version`: update if new `val` > current `best_validation_score`
   - `best_validation_score`: update if new `val` is higher
   - `consecutive_plateaus`: if `|new.overall - prev.overall| < 0.02`, increment; else reset to 0
   - `last_mutation_type`: set to type used (additive | consolidation | subtractive)

## Step 8: Git Commit

```bash
git add scenarios/icp-classification/prompts/v[N+1].md \
        scenarios/icp-classification/evals/vNNN-raw.json \
        scenarios/icp-classification/evals/vNNN.json \
        scenarios/icp-classification/mutations.log \
        scenarios/icp-classification/evals/loop-state.json

git commit -m "opt(icp-classification): v[N+1] -- [mutation-type] -- [overall_score]"
```

Example: `opt(icp-classification): v002 -- additive -- 0.78`

Note: If vNNN-raw.json and vNNN.json already existed before this iteration (as with v001), they may already be committed. Only add files that have changed.

## Step 9: Graduate to Library

Only run when the loop has halted with `halt_reason: threshold-reached`.

Run the graduation script:

```bash
python scenarios/icp-classification/evals/graduate.py scenarios/icp-classification
```

The script reads `evals/loop-state.json`, finds the best prompt version, and writes it to `library/{scenario_name}.md` with YAML frontmatter containing: scenario name, graduation date, accuracy scores (overall/train/validation), threshold, iterations run, best version, target model, test set size, and token count.

Then commit the graduated prompt:

```bash
git add library/icp-classification.md
git commit -m "grad(icp-classification): graduate {best_version} to library -- val {best_validation_score}"
```

**If halt_reason is NOT `threshold-reached`:** Do NOT auto-graduate. Report in the halt report that the loop ended without reaching threshold. The user can manually run `graduate.py` to graduate the current best if desired.

## Halt Report Format

When the loop halts, report:

- **Halt reason:** [threshold-reached | max-iterations | convergence-plateau | overfitting | token-budget-exhausted]
- **Best version:** [vNNN] with validation score [X.XX]
- **Iterations run:** [N]
- **Score progression:**

| Version | Overall | Train | Validation | Tokens |
|---------|---------|-------|------------|--------|
| v001    | 0.640   | 0.655 | 0.622      | 267    |
| v002    | ...     | ...   | ...        | ...    |

- **Graduation candidate:** `scenarios/icp-classification/prompts/[best-version].md` -- ready for Phase 4
