# Phase 1: Scenario Foundation + Ground Truth - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the scenario file format (scenario.json), input file structure, and Opus-generated ground truth with human review checkpoint. This phase produces the file conventions and methodology for creating scenarios — not the optimization loop itself.

</domain>

<decisions>
## Implementation Decisions

### Scenario File Format
- **D-01:** Scenario definition uses JSON (scenario.json) — parseable by both humans and LLMs, matches research-process-builder's proven pattern
- **D-02:** Each scenario is a self-contained directory with known file structure (scenario.json, inputs/, ground-truth/, prompts/, evals/, library/)
- **D-03:** scenario.json contains: task description, input/output schema (dynamic per scenario), rubric dimensions with weights, config (target model, accuracy threshold, max iterations, token budget)
- **D-04:** Output schema is dynamic — the prompt defines what fields to extract, not the scenario. Scenario defines the expected shape/structure but field names come from the task.

### Ground Truth Generation Flow
- **D-05:** Batch generation with inline review — Opus generates all ground truth outputs, then user reviews the full set for consistency before approving
- **D-06:** Ground truth stored as individual JSON files (one per input) in ground-truth/ subdirectory
- **D-07:** Each ground truth file contains: input reference, expected output, generation timestamp, approval status
- **D-08:** Consistency check: generate ground truth twice for each input, flag any where outputs disagree materially (not just phrasing). User resolves disagreements.

### Train/Validation Split
- **D-09:** Default 60/40 train/validation split, configurable per scenario in scenario.json
- **D-10:** Split is deterministic (seeded) so reruns produce the same split
- **D-11:** Split happens after ground truth approval, before optimization begins
- **D-12:** With 5-10 inputs, expect 3-6 train and 2-4 validation examples

### Language Style
- **D-13:** All ground truth outputs use normalized casual business language (LeadGrow-native). "CMOs" not "Chief Marketing Officers", "mid-market" not "200-500 employees", "commercial cleaning" not "janitorial services and facility management"
- **D-14:** The rubric includes a "style" dimension (weight ~0.15-0.2) to enforce casual language even when content is semantically correct

### Claude's Discretion
- Exact JSON schema field names and nesting in scenario.json
- Directory naming conventions (kebab-case, date prefixes, etc.)
- How to handle edge cases in ground truth generation (ambiguous inputs, companies with insufficient information)
- Whether to include a README.md template per scenario directory

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Patterns
- `.planning/research/ARCHITECTURE.md` — File structure, component boundaries, data flow for the system
- `.planning/research/STACK.md` — SIMBA approach, mutation strategies, evaluation patterns
- `.planning/research/FEATURES.md` — Table stakes vs differentiators, dependency graph
- `.planning/research/PITFALLS.md` — Ground truth quality risks (Pitfall 5), overfitting setup (Pitfall 1)

### Existing Patterns
- `../research-process-builder/ground-truth/schema.json` — Ground truth schema pattern from RPB
- `../research-process-builder/ground-truth/stripe.json` — Example ground truth file from RPB
- `../research-process-builder/SKILL.md` — RPB methodology (the pattern we're adapting)

### Source Inputs (First Scenario)
- The 8 company descriptions provided in the original conversation (DBS Building Solutions, TRX Services, OSP, Bartos Industries, ROUSH CleanTech, Wisconsin Plastics, Abacus AI, Dealer Teamwork, Title One)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing code in this repo — greenfield project

### Established Patterns
- research-process-builder's ground-truth/ directory pattern (one JSON per company, schema.json for validation)
- research-process-builder's baselines/ pattern (iteration snapshots as JSON)
- autocontext's AgentTaskSpec pattern (task_prompt, judge_rubric, output_format, calibration_examples)

### Integration Points
- Scenario directories will be the primary unit consumed by Phase 2 (execution + evaluation)
- Ground truth files are the scoring reference for Phase 2's LLM judge
- Train/validation split labels stored in ground truth files, consumed by Phase 3's overfitting detection

</code_context>

<specifics>
## Specific Ideas

- First scenario to build: ICP classification from company descriptions (the 8 companies provided)
- Ground truth output style: normalized casual labels ("CMOs", "mid-market", "commercial cleaning")
- The scenario should be portable — copy the directory to another project and it works without any project config dependency

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-scenario-foundation-ground-truth*
*Context gathered: 2026-03-31 via --auto mode*
