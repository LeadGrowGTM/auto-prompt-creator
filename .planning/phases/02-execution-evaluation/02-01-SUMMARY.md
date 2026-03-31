---
phase: 02-execution-evaluation
plan: 01
subsystem: execution
tags: [haiku, claude-cli, prompt-engineering, icp-classification, json-parsing]

# Dependency graph
requires:
  - phase: 01-ground-truth
    provides: "9 ground truth files with input data and expected outputs"
provides:
  - "v001.md candidate prompt for Haiku ICP classification"
  - "v001-raw.json with all 9 Haiku outputs parsed and validated"
  - "mutations.log format established for prompt versioning"
  - "run-v001.mjs runner script for executing prompts via claude CLI"
affects: [02-02-PLAN, 03-mutation-loop]

# Tech tracking
tech-stack:
  added: [claude-cli-haiku-routing]
  patterns: [prompt-file-to-stdin-pipe, json-parse-with-fence-stripping, temp-file-shell-escaping]

key-files:
  created:
    - scenarios/icp-classification/prompts/v001.md
    - scenarios/icp-classification/evals/v001-raw.json
    - scenarios/icp-classification/evals/run-v001.mjs
    - scenarios/icp-classification/mutations.log
  modified: []

key-decisions:
  - "Used claude CLI with stdin piping to avoid Windows shell escaping issues with pipe characters"
  - "Runner script writes prompts to temp files before piping to claude CLI"
  - "Haiku returns code-fenced JSON despite instructions not to -- parser strips fences successfully"

patterns-established:
  - "Prompt execution via claude CLI: write prompt to temp file, pipe to claude --print --model haiku"
  - "JSON response cleaning: strip code fences, extract JSON object via regex, validate required fields"
  - "Mutation log format: ## vNNN (source) with timestamp, source, train/validation scores"

requirements-completed: [EXEC-01, EXEC-02, EXEC-03, TRACK-01, TRACK-02]

# Metrics
duration: 7min
completed: 2026-03-31
---

# Phase 02 Plan 01: Execution & Raw Results Summary

**v001 candidate prompt executed against Haiku for all 9 ICP inputs via claude CLI -- 9/9 successful parses, 0 failures, all 6 JSON fields present in every response**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-31T17:47:21Z
- **Completed:** 2026-03-31T17:54:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created v001.md candidate prompt with output schema, casual language rules, and size definitions
- Executed v001 against Haiku for all 9 ground truth inputs with 100% parse success rate
- Established prompt versioning format (mutations.log) and execution runner pattern (run-v001.mjs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create v001 candidate prompt and mutations.log** - `fa59c76` (feat)
2. **Task 2: Execute v001 against Haiku for all 9 inputs** - `51e3d25` (feat)

## Files Created/Modified
- `scenarios/icp-classification/prompts/v001.md` - First candidate prompt for Haiku ICP classification
- `scenarios/icp-classification/mutations.log` - Append-only mutation history with v001 initial entry
- `scenarios/icp-classification/evals/v001-raw.json` - Raw Haiku outputs for all 9 inputs with parse status
- `scenarios/icp-classification/evals/run-v001.mjs` - Runner script that executes prompts via claude CLI

## Decisions Made
- Used claude CLI stdin piping pattern instead of inline `-p` flag to avoid Windows shell interpretation of pipe characters in prompt text
- Runner script writes each prompt to a temp file, then pipes to `claude --print --model haiku` via git-bash
- Haiku consistently returns code-fenced JSON despite explicit instructions not to -- the parser handles this gracefully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Windows shell escaping for pipe characters in prompt**
- **Found during:** Task 2 (Haiku execution)
- **Issue:** Prompt contains `|` characters (e.g., "startup | SMB | mid-market | enterprise") which Windows CMD interprets as pipe operators, breaking the claude CLI call
- **Fix:** Write each prompt to a temp file, use git-bash as shell, pipe file content to claude CLI via stdin
- **Files modified:** scenarios/icp-classification/evals/run-v001.mjs
- **Verification:** All 9 inputs processed successfully after fix
- **Committed in:** 51e3d25 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Shell escaping fix was necessary for Windows compatibility. No scope creep.

## Issues Encountered
- Haiku ignores the "no markdown code fences" instruction in v001.md and wraps JSON in triple-backtick fences. The parser strips these successfully, but this is worth noting for the judge evaluation -- it may affect label_normalization scoring if Haiku's instruction-following is inconsistent.

## Preliminary Quality Observations
- Haiku classified several companies as "strong" ICP fit when ground truth says "weak" or "moderate" (e.g., abacus-ai: Haiku=strong, expected=weak; title-one: Haiku=strong, expected=weak). This suggests the v001 prompt needs stronger guidance on what makes outbound lead gen a poor fit.
- Industry labels are reasonably casual but decision_maker titles are sometimes too formal (e.g., "VP of Sales" instead of "sales VPs").

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- v001-raw.json is ready for the Opus judge in Plan 02
- mutations.log format established for Phase 3's mutation loop
- Runner script pattern (run-v001.mjs) can be adapted for future prompt versions

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 02-execution-evaluation*
*Completed: 2026-03-31*