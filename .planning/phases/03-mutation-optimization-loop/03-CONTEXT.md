# Phase 3: Mutation + Optimization Loop - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Analyze failures from eval results, generate targeted prompt mutations (SIMBA-style), enforce convergence/overfitting/token-budget rules, and run the full anneal loop until 92% accuracy or halt condition. This phase produces the optimization engine that turns v001 (64% baseline) into a graduated prompt candidate.

</domain>

<decisions>
## Implementation Decisions

### Failure Analysis (MUT-01, MUT-02)
- **D-01:** Opus performs per-input failure analysis — reads each input where Haiku scored below threshold, compares field-by-field against ground truth, and names the specific failure (e.g., "icp_fit: predicted strong, actual weak").
- **D-02:** After per-input analysis, Opus aggregates across inputs to identify repeating failure patterns and assigns named taxonomy labels (e.g., "strong-fit-bias", "formal-language-regression", "missing-field", "hallucinated-data").
- **D-03:** Failure analysis output is structured JSON: array of named patterns, each with frequency count, affected inputs, affected dimensions, and a concrete description of what went wrong.
- **D-04:** Known baseline failure from Phase 2: Haiku defaults to "strong" icp_fit in 6+ of 9 inputs. Accuracy dimension scored 0.472 (worst). This is the primary target for first mutations.

### Mutation Strategy (MUT-01, MUT-03)
- **D-05:** First iterations use additive mutations — append targeted corrective rules to the prompt section that addresses the highest-frequency failure pattern. Preserves what's already working (completeness at 0.972).
- **D-06:** If score plateaus for 2+ consecutive iterations with additive-only mutations, switch to consolidation/rewrite pass — compress and restructure the prompt to be more coherent rather than just appending rules.
- **D-07:** Subtractive mutations (removing/simplifying instructions) only when approaching the 800-token budget.
- **D-08:** Each mutation is a single focused change targeting one failure pattern. No multi-target mutations — isolate what works.

### Token Budget (MUT-04)
- **D-09:** 800-token cap from scenario.json. Monitor prompt length each iteration.
- **D-10:** When prompt reaches 700+ tokens, trigger consolidation pass: Opus rewrites the prompt to be more concise while preserving all active rules.
- **D-11:** If prompt hits 800 tokens and still below threshold, halt with a "token-budget-exhausted" status rather than silently truncating.

### Loop Control (LOOP-01, LOOP-02, LOOP-03, LOOP-04)
- **D-12:** Anneal loop runs autonomously via a single orchestration script (run-anneal.mjs pattern, extending run-v001.mjs). Loop: execute prompt on all inputs → judge all outputs → analyze failures → generate mutation → write new prompt version → repeat.
- **D-13:** Halt conditions (checked after each iteration):
  - **Success:** Overall accuracy >= 0.92 (from scenario.json threshold)
  - **Max iterations:** 15 iterations reached (from scenario.json)
  - **Convergence plateau:** Score delta < 0.02 for 3 consecutive iterations
  - **Overfitting:** Train-validation gap exceeds 0.08 (8%)
  - **Token budget:** Prompt exceeds 800 tokens after consolidation attempt
- **D-14:** Train and validation scores tracked separately every iteration (infrastructure exists from Phase 2).
- **D-15:** Semantic drift check every 3 iterations — re-evaluate whether the prompt still addresses the original task description from scenario.json. If drift detected, flag and log but don't auto-halt (Opus reports, human decides).
- **D-16:** On any halt: report the best version (highest validation score across all iterations) as the graduation candidate for Phase 4.

### Loop Execution Model
- **D-17:** The anneal loop is NOT a standalone script that runs unattended. It's a CC skill/methodology: each iteration is orchestrated by Opus (the current session), which spawns Haiku agents for execution, judges outputs, analyzes failures, and writes the next prompt version. The "script" is the structured process, not a runnable .mjs file.
- **D-18:** Each iteration produces: `prompts/vNNN.md` (new prompt), `evals/vNNN-raw.json` (Haiku outputs), `evals/vNNN.json` (judge scores), `mutations.log` entry (what changed and why).

### Git Tracking (TRACK-03)
- **D-19:** Each iteration is git-committed as an atomic commit: prompt file + eval files + mutations.log update. Commit message follows pattern: `opt(icp-classification): vNNN — [mutation type] — [score]`.
- **D-20:** Full prompt lineage is diffable via `git log --follow prompts/`.

### Claude's Discretion
- Exact structure of the failure analysis prompt given to Opus
- How to format the mutation instruction that transforms vN into vN+1
- Whether to use the run-v001.mjs script as a literal base or rewrite the execution pattern
- Calibration of "semantic drift" — what constitutes meaningful drift vs normal prompt evolution

### Folded Todos
None — no matching todos found.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 Artifacts (Direct Inputs)
- `scenarios/icp-classification/evals/v001.json` — Baseline eval results: 64% overall, per-input and per-dimension breakdown. THIS is what failure analysis reads.
- `scenarios/icp-classification/prompts/v001.md` — Baseline prompt to mutate from
- `scenarios/icp-classification/mutations.log` — Append-only log, already has v001 entry
- `scenarios/icp-classification/evals/run-v001.mjs` — Execution script pattern (Haiku via claude CLI stdin piping)

### Scenario Config
- `scenarios/icp-classification/scenario.json` — Rubric dimensions/weights, config (threshold: 0.92, max_iterations: 15, token_budget: 800), output schema, label definitions
- `scenarios/icp-classification/ground-truth/*.json` — 9 reference outputs (5 train, 4 validation) with split labels

### Architecture & Strategy
- `.planning/research/STACK.md` — SIMBA approach details, mutation strategies ranked by relevance
- `.planning/research/ARCHITECTURE.md` — System design, component boundaries, data flow
- `.planning/research/PITFALLS.md` — Overfitting risks (Pitfall 1), prompt bloat (Pitfall 3), judge noise floor

### Prior Phase Context
- `.planning/phases/02-execution-evaluation/02-CONTEXT.md` — Execution and judge design decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **run-v001.mjs** — Execution script that handles Haiku agent spawning via claude CLI stdin piping. Pattern: write prompt to temp file, pipe to `claude --print --model haiku`, parse JSON response, handle failures. Directly reusable for iteration execution.
- **v001.json eval structure** — Full eval schema with per-input, per-dimension, aggregate scores, train/validation split tracking. Judge output format is locked.
- **scenario.json** — Config source of truth for threshold, max_iterations, token_budget, rubric weights.

### Established Patterns
- **Stdin piping** for Haiku execution (avoids Windows shell escaping issues)
- **Code fence stripping** in response parsing (Haiku ignores no-code-fence instructions)
- **3-run median voting** for judge stability
- **One file per entity** (prompt, eval, ground truth — all individual files)

### Integration Points
- `prompts/` — v001.md exists, v002.md+ will be created by mutation loop
- `evals/` — v001 files exist, vNNN files will be created each iteration
- `mutations.log` — initialized with v001 entry, each iteration appends
- `library/` — empty, receives graduated prompts from Phase 4

</code_context>

<specifics>
## Specific Ideas

- Primary failure to fix first: Haiku's strong-fit bias (defaults to "strong" icp_fit when ground truth says "moderate" or "weak"). This is the single biggest accuracy blocker.
- The mutation engine should be SIMBA-style: Opus reads what went wrong, generates a specific rule that addresses the failure, and appends it to the prompt. Self-reflective, not random.
- Keep the loop simple — greedy hill-climbing. Each iteration tries to beat the previous best. No population, no branching.
- v001 baseline: 64% overall. Accuracy 0.472, label_normalization 0.611, completeness 0.972, specificity 0.694. Train/validation gap 0.033 (healthy).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-mutation-optimization-loop*
*Context gathered: 2026-03-31 via --auto mode*
