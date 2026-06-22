# Ubiquitous Language Glossary

Terms extracted from the actual codebase: `setup.mjs`, `METHODOLOGY.md`, `CLAUDE.md`, `scenario.json`, `loop-state.json`.

| Term | Definition | Key Files |
|------|-----------|----------|
| **scenario** | A named optimization task: one prompt, one rubric, one dataset. The unit of work in this system. | `setup.mjs`, `scenarios/[name]/scenario.json` |
| **scenario.json** | Configuration file per scenario: rubric, accuracy threshold, token budget, max iterations, mutation phase bounds, data split ratios. Source of truth for the loop's operating parameters. | `scenarios/[name]/scenario.json` |
| **loop-state.json** | Mutable state file tracking current iteration, best version, score history, halt reason, and consecutive plateau count. Authoritative — checked before every iteration. | `scenarios/[name]/evals/loop-state.json` |
| **ground truth** | Expert-validated reference output for a given input. Haiku's output is scored against this. Never modified after validation. | `scenarios/[name]/ground-truth/[slug].json` |
| **rubric** | Weighted set of scoring dimensions defined in `scenario.json`. Each dimension has a weight (0-1, summing to 1) and a description used by the judge. | `scenario.json` → `rubric.dimensions` |
| **dimension** | One axis of the rubric. Scored 1-5 per input, then normalized to 0-1 via `(score - 1) / 4`. Examples: `accuracy`, `label_normalization`, `specificity`. | `scenario.json`, `judge.mjs` |
| **split** | Dataset partition label: `train` (60%), `val` (30%), `holdout` (10%). Holdout is never scored during the loop — only at graduation. | `ground-truth/*.json`, `loop-state.json` |
| **mutation** | One iteration's change to the prompt. Has a type (`additive`, `structural`, `targeted`, `consolidation`, `subtractive`) that constrains what changes are allowed per phase. | `METHODOLOGY.md`, `loop-state.json` → `last_mutation_type` |
| **mutation phase** | Three-phase constraint on allowed mutation types: Bootstrap (1-3, all types), Generalize (4-7, structural only, examples blocked), Polish (8-10, subtractive encouraged). | `METHODOLOGY.md`, `scenario.json` → `mutation_phases` |
| **halt condition** | One of five triggers that ends the loop: threshold reached, max iterations, convergence plateau, overfitting, token budget exceeded. Stored in `loop-state.json` → `halt_reason`. | `METHODOLOGY.md`, `loop-state.json` |
| **graduation** | The act of promoting the best-scoring prompt to `library/` after it passes holdout scoring. Requires holdout-val gap > -0.08. | `METHODOLOGY.md`, `library/` |
| **val score** | Weighted average score across all `val`-split inputs for a prompt version. Primary optimization signal. Must reach `accuracy_threshold` (default 0.92) to graduate. | `loop-state.json` → `best_validation_score` |
| **overfitting threshold** | Maximum allowed gap between train score and val score (default 0.12). Exceeded gap triggers halt with reason `overfitting`. | `scenario.json` → `overfitting_threshold` |
| **token budget** | Maximum allowed estimated token count for a prompt (default 800). Exceeded budget triggers halt with reason `token-budget`. | `scenario.json` → `token_budget` |
| **example cap** | Maximum worked examples per concept (default 4). Enforced to prevent prompt from becoming a lookup table. | `scenario.json` → `example_cap_per_concept`, `METHODOLOGY.md` |
| **icp-loop mode** | Alternative scenario mode for interactive batch-by-batch human validation instead of automated scoring. Gate: 3 consecutive clean batches required before graduation. | `setup.mjs`, `icp-loop.mjs` (generated) |
| **service_tier: flex** | Anthropic API tier used by `run-eval.mjs`. Lower priority/cost than standard tier — appropriate for batch eval runs that aren't time-sensitive. | generated `run-eval.mjs` |
| **run-eval.mjs** | Per-scenario generated eval runner. Reads a prompt version, calls the model API on all ground-truth inputs for the specified split, writes raw outputs to `vNNN-raw.json`. | `scenarios/[name]/evals/run-eval.mjs` |
| **judge.mjs** | Per-scenario generated scorer. Three modes: emit score template for manual scoring, finalize a filled template into `vNNN.json`, or auto-score with Opus. | `scenarios/[name]/evals/judge.mjs` |
| **convergence plateau** | Three consecutive iterations where val score delta is less than 0.02. Triggers halt — current approach is exhausted. | `METHODOLOGY.md`, `loop-state.json` → `consecutive_plateaus` |
