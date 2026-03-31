---
phase: 02-execution-evaluation
verified: 2026-03-31T18:15:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 02: Execution & Evaluation Verification Report

**Phase Goal:** User can run a candidate prompt against Haiku and get reliable, structured scoring against ground truth
**Verified:** 2026-03-31T18:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

Plan 01 truths (EXEC / TRACK requirements):

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | v001.md contains a complete candidate prompt with task instruction, output schema, rules, and input placeholder | VERIFIED | File exists, contains "Return ONLY a JSON object", all 6 output fields, startup/SMB/mid-market/enterprise size definitions, and "Company to Classify" as last section |
| 2  | Haiku produces structured JSON output for each of the 9 inputs when given the candidate prompt | VERIFIED | v001-raw.json: 9/9 successful parses, 0 parse failures, all 6 required fields present in every haiku_output |
| 3  | Parse failures are caught and scored as 0 without crashing — the run processes all 9 inputs regardless | VERIFIED | run-v001.mjs has explicit try/catch with parse_failure flag; summary shows 0 failures (no failures occurred to trigger the path, but handler exists) |
| 4  | Raw Haiku outputs are stored in a structured file for the judge to consume | VERIFIED | v001-raw.json: valid JSON, prompt_version, timestamp, config, results array with input_id/split/haiku_output/raw_response/parse_failure/missing_fields, summary block |
| 5  | mutations.log exists with the v001 initial entry | VERIFIED | Contains "## v001 (initial)", Created timestamp, Source, Train/Validation scores (updated to actuals in Plan 02) |

Plan 02 truths (EVAL requirements):

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 6  | Opus judges each Haiku output against ground truth using the 4-dimension rubric with calibration anchors | VERIFIED | v001.json config shows judge_model="opus", rubric_version=1; plan used DBS Building Solutions and OSP as calibration anchors per the judge prompt template |
| 7  | Each input gets 3 independent judge runs and the median score per dimension is used | VERIFIED | v001.json dimensions contain "runs" arrays with 3 values each (e.g., accuracy: [2,2,2], label_normalization: [3,3,4]); config.judge_runs=3; normalization formula "(score - 1) / 4" verified correct |
| 8  | Per-input scores are aggregated into train score, validation score, and overall score | VERIFIED | aggregate: overall_score=0.6403, train_score=0.655, validation_score=0.622; 5 train + 4 validation inputs correctly split |
| 9  | The evaluation result file contains all per-input, per-dimension, and aggregate scores | VERIFIED | 9 per_input entries each with weighted_score, 4 dimensions (median/runs/normalized), haiku_output, judge_rationales; aggregate has dimension_averages |
| 10 | Parse-failed inputs from Plan 01 are scored as 0.0 without re-running the judge | VERIFIED | No parse failures occurred (0 in v001-raw.json), but judge_skipped field exists in schema and plan specifies the 0.0 handling path |

**Score: 10/10 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scenarios/icp-classification/prompts/v001.md` | First candidate prompt for Haiku | VERIFIED | 24 lines, contains all required sections and patterns |
| `scenarios/icp-classification/evals/v001-raw.json` | Raw Haiku outputs for all 9 inputs | VERIFIED | Valid JSON, 9 results, 0 parse failures, all 6 fields in every haiku_output |
| `scenarios/icp-classification/mutations.log` | Append-only mutation history with v001 entry | VERIFIED | Contains "## v001 (initial)", actual numeric scores (not "pending") |
| `scenarios/icp-classification/evals/v001.json` | Complete evaluation results for prompt v001 | VERIFIED | Valid JSON, 9 per_input entries, aggregate with overall/train/validation, 4-dimension breakdown |
| `scenarios/icp-classification/README.md` | Updated with v001 scores and status | VERIFIED | Status "evaluating", scores table, dimension breakdown, "Current accuracy: 64.0%" |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scenarios/icp-classification/prompts/v001.md` | CC Agent with model=haiku | Prompt piped via stdin in run-v001.mjs | WIRED | run-v001.mjs reads PROMPT_FILE, appends input, writes to temp file, pipes to `claude --print --model haiku` |
| `scenarios/icp-classification/ground-truth/*.json` | `evals/v001-raw.json` | Input fields read from ground truth, passed to Haiku | WIRED | run-v001.mjs iterates GT_DIR, extracts gt.input, builds fullPrompt, stores result with input_id from gt.id |
| `evals/v001-raw.json` | `evals/v001.json` | Opus judge scores each haiku_output against ground truth | WIRED | v001.json per_input contains identical haiku_output objects from v001-raw.json (verified by JSON equality check); IDs match 9/9 |
| `scenarios/icp-classification/scenario.json` | `evals/v001.json` | Rubric weights used for score aggregation | WIRED | Weighted score formula verified: accuracy*0.4 + label_norm*0.25 + completeness*0.2 + specificity*0.15 = weighted_score (match: PASS, delta < 0.001) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `v001-raw.json` | haiku_output | claude CLI via run-v001.mjs calling Haiku per input | Yes — 9 unique JSON objects with distinct company classifications | FLOWING |
| `v001.json` | per_input[].dimensions | Opus judge runs (3x per input) scoring against ground truth | Yes — distinct scores per input, rationales reference specific company details | FLOWING |
| `mutations.log` | Train score / Validation score | Pulled from v001.json aggregate | Yes — numeric values 0.655 / 0.622, not placeholders | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| v001-raw.json has 9 results, 0 parse failures | node parse + field count | 9 results, successful_parses=9, parse_failures=0 | PASS |
| v001.json normalization formula (score-1)/4 | Computed vs stored for abacus-ai accuracy | median=2, normalized=0.25, expected=0.25 | PASS |
| v001.json weighted score computation | accuracy*0.4+label_norm*0.25+completeness*0.2+specificity*0.15 | delta < 0.001 for abacus-ai | PASS |
| mutations.log has actual scores, not "pending" | Regex match for decimal values | Train score: 0.655, Validation score: 0.622 | PASS |
| README reflects live scores | grep for "Current accuracy:" and scores table | "Current accuracy: 64.0%", v001 row present | PASS |
| Commits exist for both tasks | git log | fa59c76 (v001 prompt), 51e3d25 (Haiku execution), ac31119 (Opus judge), 68a87a6 (mutations.log/README update) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EXEC-01 | 02-01 | Candidate prompts executed against Haiku via CC agent spawning | SATISFIED | run-v001.mjs executes claude CLI with `--model haiku`; 9/9 outputs captured |
| EXEC-02 | 02-01 | Raw Haiku output captured and parsed into structured form | SATISFIED | v001-raw.json contains haiku_output (parsed JSON) and raw_response (original text) for all 9 inputs |
| EXEC-03 | 02-01 | Parse failures handled gracefully (logged, scored as 0, not crash) | SATISFIED | run-v001.mjs has try/catch; parse_failure field set in results; plan's task acceptance criteria verified; no failures occurred in practice |
| EVAL-01 | 02-02 | Opus judges Haiku output against ground truth using multi-dimension rubric | SATISFIED | v001.json shows 4 dimensions (accuracy, label_normalization, completeness, specificity) with calibration anchors used in judge prompt |
| EVAL-02 | 02-02 | Evaluation results stored as structured JSON per iteration | SATISFIED | v001.json: per-input scores, per-dimension scores, aggregate accuracy, train/validation split |
| EVAL-03 | 02-02 | Judge uses concrete pass/fail examples from rubric (calibration anchors) | SATISFIED | Plan task uses DBS Building Solutions for accuracy anchors, OSP pain points for specificity anchors — judge prompt template includes 5/5 and 1/5 examples per dimension |
| EVAL-04 | 02-02 | Multi-run voting (3 judge runs, median score) to reduce scoring noise | SATISFIED | v001.json dimensions.*.runs arrays have 3 values each; config.judge_runs=3; median taken |
| TRACK-01 | 02-01 | Each prompt version stored as immutable file (prompts/v001.md) | SATISFIED | File exists at correct path, git-committed |
| TRACK-02 | 02-01 | Mutations logged in append-only mutations.log | SATISFIED | mutations.log contains v001 entry with timestamp, source, actual scores |

**All 9 requirements for Phase 2 are satisfied.**

No orphaned requirements — REQUIREMENTS.md traceability table lists exactly EXEC-01, EXEC-02, EXEC-03, EVAL-01, EVAL-02, EVAL-03, EVAL-04, TRACK-01, TRACK-02 as Phase 2 / Complete. All accounted for.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| None | — | — | All 4 key files scanned: no TODO/FIXME, no "pending" values, no placeholder text, no empty returns |

Extra artifact `evals/compute-scores.py` exists beyond what the plan required — no impact, not a blocker.

---

### Human Verification Required

None required. All goal criteria are verifiable programmatically via file structure, JSON validation, and arithmetic checks.

The judge scoring quality (whether Opus accurately scored the Haiku outputs) is inherently subjective, but that is a quality concern for Phase 3, not a Phase 2 verification concern. The infrastructure is correct.

---

## Gaps Summary

No gaps. All 10 truths verified, all 5 artifacts present and substantive, all 4 key links wired, all 9 requirements satisfied. Phase 2 goal achieved.

**Baseline established:** 64.0% overall accuracy (train: 65.5%, validation: 62.2%). Primary failure mode is icp_fit misclassification — Haiku defaults strong/moderate, ground truth has weak fits for 3/9 inputs. Phase 3 has clear mutation targets.

---

_Verified: 2026-03-31T18:15:00Z_
_Verifier: Claude (gsd-verifier)_
