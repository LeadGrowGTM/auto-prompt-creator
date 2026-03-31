# Phase 2: Execution + Evaluation - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Run candidate prompts against Haiku via CC agent spawning, score outputs against ground truth using Opus as judge with multi-dimension rubric, and track prompt versions immutably. This phase produces the execution engine and evaluation framework that Phase 3's mutation loop will consume.

</domain>

<decisions>
## Implementation Decisions

### Agent Spawning (EXEC-01, EXEC-02, EXEC-03)
- **D-01:** Haiku is invoked via CC Agent tool with `model="haiku"` parameter and the candidate prompt passed inline. No separate skill files or external API calls.
- **D-02:** Agent receives the candidate prompt + one input at a time. Returns structured JSON matching the output schema from scenario.json.
- **D-03:** Parse failures (malformed JSON, missing fields) are caught, logged with the raw output, and scored as 0.0 for that input. The run continues to the next input — never crash the session.

### Judge Design (EVAL-01, EVAL-02, EVAL-03, EVAL-04)
- **D-04:** Opus judges field-by-field, scoring each rubric dimension (accuracy: 0.4, label_normalization: 0.25, completeness: 0.2, specificity: 0.15) on a 1-5 scale per input.
- **D-05:** Judge prompt receives: ground truth output, Haiku output, rubric definitions, and calibration anchors (examples of 5/5 vs 1/5 for each dimension).
- **D-06:** Multi-run voting: 3 judge runs per input, take median per-dimension score. This reduces Opus scoring noise.
- **D-07:** Judge returns structured JSON with per-dimension scores and a brief rationale string per dimension.

### Scoring Aggregation
- **D-08:** Per-input score = weighted average across dimensions (using rubric weights from scenario.json).
- **D-09:** Prompt-level score = arithmetic mean of all per-input scores across the evaluation set.
- **D-10:** Train and validation scores computed separately (using the split from Phase 1) so Phase 3 can detect overfitting.

### Iteration Tracking (TRACK-01, TRACK-02)
- **D-11:** Each prompt version stored as `prompts/v001.md`, `prompts/v002.md`, etc. — immutable after creation.
- **D-12:** Evaluation results stored as JSON files in `evals/` — one file per prompt version (e.g., `evals/v001.json`) containing per-input scores, per-dimension scores, aggregate scores, and metadata.
- **D-13:** `mutations.log` is append-only: each entry records what changed, why, which failure pattern targeted, and the score delta. Phase 2 creates the file format; Phase 3 populates it.

### Claude's Discretion
- Exact prompt template for the Haiku agent call — researcher/planner decide structure
- Exact JSON schema for eval result files — planner decides field names
- Whether to run train-only or train+validation during iteration (Phase 3 decides policy; Phase 2 builds capability for both)
- Calibration anchor examples for the judge — can be derived from ground truth during planning

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scenario Definition
- `scenarios/icp-classification/scenario.json` — Rubric dimensions, weights, scoring rules, output schema, config (threshold, max_iterations, token_budget)
- `scenarios/icp-classification/README.md` — Scenario status and structure overview

### Ground Truth (Reference Outputs)
- `scenarios/icp-classification/ground-truth/*.json` — 9 Opus-generated gold-standard outputs (the comparison target for judging)

### Train/Validation Split
- `scenarios/icp-classification/README.md` — Documents the 5-train/4-validation split and seed

### Research
- `.planning/research/STACK.md` — Technology evaluation, mutation strategies, evaluation approaches
- `.planning/research/ARCHITECTURE.md` — System design decisions
- `.planning/research/PITFALLS.md` — Known risks and mitigations

### Prior Phase
- `.planning/phases/01-scenario-foundation-ground-truth/01-02-SUMMARY.md` — Phase 1 completion summary, consistency check results

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **scenario.json** — Fully defines rubric, schema, config. Phase 2 code reads this as the source of truth for scoring weights and output validation.
- **ground-truth/*.json** — 9 reference outputs ready for judge comparison. Each contains `input` + `expected_output` with 6 fields.

### Established Patterns
- **JSON throughout** — scenario.json, ground-truth files, input files all use JSON. Eval results should follow suit.
- **One file per entity** — one ground truth file per company, one eval file per prompt version. Consistent with Phase 1 convention.
- **Directory-per-scenario** — all artifacts scoped under `scenarios/icp-classification/`

### Integration Points
- `prompts/` — empty dir ready for v001.md, v002.md
- `evals/` — empty dir ready for eval result JSON files
- `library/` — empty dir for Phase 4 graduation
- Phase 3 will consume eval results to drive mutation decisions

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraints from PROJECT.md:
- Haiku 4.5 is the target model
- 92% accuracy threshold
- Casual language (label_normalization dimension enforces this)
- CC sessions only — zero external API cost

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-execution-evaluation*
*Context gathered: 2026-03-31*
