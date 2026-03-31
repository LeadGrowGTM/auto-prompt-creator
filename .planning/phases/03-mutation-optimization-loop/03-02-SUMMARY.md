---
phase: 03-mutation-optimization-loop
plan: "02"
subsystem: prompt-optimization
tags: [simba, mutation-engine, failure-analysis, opus-prompts, anneal-loop]

# Dependency graph
requires:
  - phase: 02-execution-evaluation
    provides: v001.json eval results with per-input scores and judge rationales
provides:
  - "Opus prompt template for failure analysis (reads eval JSON, outputs structured failure taxonomy)"
  - "Opus prompt template for mutation instruction (transforms vN into vN+1 with one targeted change)"
affects: [03-mutation-optimization-loop/plan-03, anneal-loop-execution]

# Tech tracking
tech-stack:
  added: []
  patterns: [placeholder-injection prompts, structured JSON output schema, SIMBA self-reflective mutation]

key-files:
  created:
    - .planning/phases/03-mutation-optimization-loop/prompts/failure-analysis-prompt.md
    - .planning/phases/03-mutation-optimization-loop/prompts/mutation-instruction-prompt.md
  modified: []

key-decisions:
  - "Failure analysis uses severity tiers tied to rubric weights (critical = accuracy dimension in 3+ inputs)"
  - "Mutation type decision tree: additive default, consolidation on plateau/700+ tokens, subtractive on 750+ post-consolidation"
  - "ICP Fit Guidance and Label Normalization Guidance as pre-built sections for the two known v001 failure patterns"

patterns-established:
  - "Placeholder injection: {{EVAL_JSON}}, {{CURRENT_PROMPT}}, {{FAILURE_ANALYSIS}}, {{LOOP_STATE}} replaced at runtime"
  - "Taxonomy labeling: precise pattern names (strong-fit-bias, formal-language-regression) over generic descriptions"
  - "Mutation log entry format: version transition, target, type, mutation description, token count, score delta"

requirements-completed: [MUT-01, MUT-02, MUT-03]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 3 Plan 2: Opus Prompt Templates Summary

**Two concrete Opus prompt templates powering the anneal loop intelligence layer: failure analysis (eval JSON to failure taxonomy JSON) and mutation instruction (failure taxonomy + current prompt to next version with mutation log)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T19:23:42Z
- **Completed:** 2026-03-31T19:26:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- failure-analysis-prompt.md: complete Opus prompt that reads scored eval JSON and outputs structured failure taxonomy with named patterns, severity tiers, affected inputs, and actionable suggested_rules
- mutation-instruction-prompt.md: complete Opus prompt with three mutation types (additive/consolidation/subtractive), decision criteria, ICP Fit and Label Normalization guidance sections, and mutation log entry format
- Both prompts are linked: failure analysis output (priority_target, patterns array) feeds directly into mutation instruction input

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failure-analysis-prompt.md** - `fbe71fe` (feat)
2. **Task 2: Write mutation-instruction-prompt.md** - `c49d4fe` (feat)

## Files Created/Modified
- `.planning/phases/03-mutation-optimization-loop/prompts/failure-analysis-prompt.md` - Opus prompt for analyzing eval results into structured failure taxonomy JSON
- `.planning/phases/03-mutation-optimization-loop/prompts/mutation-instruction-prompt.md` - Opus prompt for generating targeted prompt mutations from failure analysis

## Decisions Made
- Severity tiers mapped directly to rubric dimension weights: critical = accuracy (0.4 weight) in 3+ inputs, high = accuracy in 1-2 or other dimension in 3+
- Pre-built guidance sections for the two known v001 failure patterns (strong-fit-bias and formal-language-regression) so the mutation prompt has concrete domain knowledge baked in
- Mutation log entry format includes Token count and Score delta lines for budget tracking across iterations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - both prompt files are complete and ready for runtime use.

## Next Phase Readiness
- Both prompt templates ready for Plan 03 (anneal loop orchestration)
- failure-analysis-prompt.md accepts {{EVAL_JSON}} injection from any vNNN.json
- mutation-instruction-prompt.md accepts {{CURRENT_PROMPT}}, {{FAILURE_ANALYSIS}}, {{LOOP_STATE}} injection
- Mutation log entry format ready for mutations.log append

## Self-Check: PASSED

- FOUND: `.planning/phases/03-mutation-optimization-loop/prompts/failure-analysis-prompt.md`
- FOUND: `.planning/phases/03-mutation-optimization-loop/prompts/mutation-instruction-prompt.md`
- FOUND commit: `fbe71fe` (failure-analysis-prompt.md)
- FOUND commit: `c49d4fe` (mutation-instruction-prompt.md)
- failure-analysis-prompt.md: {{EVAL_JSON}} present, priority_target present, suggested_rule present, 4+ taxonomy labels, severity definitions, 2+ inputs rule
- mutation-instruction-prompt.md: all three placeholders present, additive/consolidation/subtractive defined, Single focus rule, ICP Fit Guidance, Label Normalization Guidance, Mutation Log Entry format, Token count + Score delta lines

---
*Phase: 03-mutation-optimization-loop*
*Completed: 2026-03-31*
