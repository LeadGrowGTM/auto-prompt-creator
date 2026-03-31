---
phase: 02-execution-evaluation
plan: 02
subsystem: evaluation
tags: [opus-judge, llm-as-judge, rubric-scoring, icp-classification, median-voting]

# Dependency graph
requires:
  - phase: 02-execution-evaluation
    provides: "v001-raw.json with 9 Haiku outputs to judge"
  - phase: 01-ground-truth
    provides: "9 ground truth files with expected outputs for comparison"
provides:
  - "v001.json complete evaluation with per-input scores, dimension breakdowns, and aggregate metrics"
  - "Opus judge methodology: 4-dimension rubric with calibration anchors, 3-run median voting"
  - "Baseline accuracy measurement: 64.0% overall (target: 92%)"
affects: [03-mutation-loop]

# Tech tracking
tech-stack:
  added: []
  patterns: [opus-as-judge-4-dimension-rubric, 3-run-median-voting, score-normalization-minus-1-div-4]

key-files:
  created:
    - scenarios/icp-classification/evals/v001.json
  modified:
    - scenarios/icp-classification/mutations.log
    - scenarios/icp-classification/README.md

key-decisions:
  - "Accuracy dimension scored harshly when icp_fit is wrong -- this is the most important classification call"
  - "Label normalization penalizes title-case formal titles (Operations Manager vs ops directors) consistently"
  - "Completeness scores near-perfect (0.972) across all inputs -- Haiku always fills all fields"
  - "Primary failure mode is icp_fit misclassification: Haiku defaults to strong/moderate, rarely says weak"

patterns-established:
  - "Judge prompt structure: ground truth + model output + 4-dimension rubric with calibration anchors + JSON-only response"
  - "Score normalization: (score - 1) / 4 maps 1-5 to 0.0-1.0"
  - "Aggregate computation: arithmetic mean of weighted scores, split by train/validation"
  - "3 independent judge runs with median selection for noise reduction"

requirements-completed: [EVAL-01, EVAL-02, EVAL-03, EVAL-04]

# Metrics
duration: 5min
completed: 2026-03-31
---

# Phase 02 Plan 02: Opus Judge Evaluation Summary

**Opus judge scored all 9 Haiku outputs with 4-dimension rubric and 3-run median voting -- baseline accuracy 64.0% (target 92%), with icp_fit misclassification as the dominant failure mode**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-31T17:56:38Z
- **Completed:** 2026-03-31T18:01:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Ran Opus judge with calibration anchors (DBS Building Solutions for accuracy, OSP for specificity) across all 9 inputs
- 3 independent judge runs per input with median score selection for noise reduction
- Identified primary failure mode: Haiku classifies 7/9 companies as "strong" when ground truth has only 3 strong fits
- Completeness near-perfect (0.972) while accuracy is the weakest dimension (0.472)

## Task Commits

Each task was committed atomically:

1. **Task 1: Run Opus judge with calibration anchors and multi-run voting** - `ac31119` (feat)
2. **Task 2: Update mutations.log and README with v001 scores** - `68a87a6` (docs)

## Files Created/Modified
- `scenarios/icp-classification/evals/v001.json` - Complete evaluation: 9 per-input scores, 4 dimensions each, 3-run medians, aggregate scores
- `scenarios/icp-classification/mutations.log` - Updated with actual train/validation scores replacing "pending"
- `scenarios/icp-classification/README.md` - Updated status to "evaluating" with scores table and dimension breakdown

## Decisions Made
- Accuracy dimension weighted most heavily at penalizing wrong icp_fit calls, since this is the primary classification output
- Title-case formal titles (e.g., "Operations Manager" vs "ops directors") consistently penalized in label_normalization
- Judge rationales kept concise (1-2 sentences) for downstream consumption by mutation engine

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Key Findings for Phase 3

**Score breakdown reveals clear mutation targets:**
- **Accuracy (0.472):** Haiku defaults to "strong" icp_fit for nearly everything. Title One scored 0.350 overall because fit was opposite (strong vs weak) and "Head of Sales" role was fabricated. Prompt needs explicit guidance on what makes a company a weak fit.
- **Label Normalization (0.611):** Haiku uses formal title-case ("VP of Sales", "Operations Manager", "Business Development Manager") instead of casual lowercase ("sales VPs", "ops directors"). Prompt needs stronger examples of casual formatting.
- **Completeness (0.972):** Near-perfect. Haiku fills all fields consistently. Not a mutation target.
- **Specificity (0.694):** Decent but reasoning often misidentifies fit direction. When Haiku gets icp_fit wrong, the reasoning is internally consistent but factually wrong about the ICP.

**Per-input score distribution:**
- Lowest: title-one (0.350) - wrong fit, fabricated role
- Low: abacus-ai (0.500), roush-cleantech (0.500) - wrong fit classification
- Mid: bartos-industries (0.638), dealer-teamwork (0.700), osp (0.700)
- High: dbs-building-solutions (0.738), wisconsin-plastics (0.800), trx-services (0.838)

## Next Phase Readiness
- v001.json is ready for Phase 3 failure pattern analysis
- Clear mutation targets identified: icp_fit classification guidance and label normalization examples
- 28-point gap to 92% target means significant prompt improvement needed

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 02-execution-evaluation*
*Completed: 2026-03-31*
