# Interface Depth Analysis

Analysis of public vs. internal surface area per module. Higher depth ratio = better encapsulation.

## Summary Table

| Module | Public Interface | Internal Functions | Depth Ratio | Verdict |
|--------|-----------------|-------------------|-------------|---------|
| `setup.mjs` | 1 CLI entry point | ~8 internal helpers | 8.0 | DEEP |
| `scenarios/[name]/evals/run-eval.mjs` (generated) | 1 CLI entry point | 3 internal functions | 3.0 | ADEQUATE |
| `scenarios/[name]/evals/judge.mjs` (generated) | 1 CLI entry point | 2 branches + scoring logic | 2.5 | ADEQUATE |
| `scenarios/[name]/evals/icp-loop.mjs` (generated, icp-loop mode only) | 1 CLI entry point | 3 internal functions | 3.0 | ADEQUATE |
| `setup.test.mjs` | 8 test cases | 3 test helpers | 0.4 | SHALLOW (test file — expected) |

---

## Module Details

### `setup.mjs`

**Path:** `C:\Users\mitch\Everything_CC\auto-prompt-creator\setup.mjs`

**Public interface (1):**
- CLI entry: `bun setup.mjs --name <name> [--mode standard|icp-loop] [--dimensions ...] [--threshold ...] [--budget ...] [--iterations ...]`

**Internal functions/logic blocks (~8):**
1. `parseArgs` call — arg validation and defaults
2. `mode` validation (`standard` | `icp-loop`)
3. Dimension string parser (`dims` loop)
4. Directory tree creation (`mkdirSync` loop)
5. `scenario` object construction (with conditional `icp_loop` block)
6. `loopState` object construction (with conditional `icp_loop` block)
7. Template string generation for `run-eval.mjs` (`runEvalTemplate`)
8. Template string generation for `judge.mjs` (`judgeTemplate`)
9. Optional template string generation for `icp-loop.mjs` (`icpLoopTemplate`)

**Depth ratio:** ~9 / 1 = **9.0 — DEEP**

The single CLI surface hides significant complexity: conditional mode branching, multi-file scaffolding, and two distinct eval runner templates. The interface is maximally simple — the implementation handles all variability internally.

---

### `run-eval.mjs` (generated per scenario)

**Path:** `scenarios/[name]/evals/run-eval.mjs`

**Public interface (1):**
- CLI: `bun run-eval.mjs --version vNNN [--split val|holdout|train]`

**Internal functions (3):**
1. `callClaude(systemPrompt, userMessage, retries)` — Anthropic API call with retry
2. `processOne(gt)` — processes one ground-truth entry: call, parse JSON, return result object
3. Concurrency loop — batches `processOne` calls 5 at a time via `Promise.all`

**Depth ratio:** 3 / 1 = **3.0 — ADEQUATE**

The concurrency and retry logic is internal. The parse failure path (extracting JSON from raw text) is also internal. The output file path construction is hardcoded, which limits reuse but keeps the interface minimal.

---

### `judge.mjs` (generated per scenario)

**Path:** `scenarios/[name]/evals/judge.mjs`

**Public interface (1):**
- CLI: `bun judge.mjs --version vNNN [--finalize | --auto]`

**Internal logic branches (2) + shared helpers:**
1. `finalize` branch — reads filled score template, normalizes scores `(raw - 1) / 4`, computes per-split averages, writes `vNNN.json`
2. Default (template generation) branch — reads raw outputs, emits `vNNN-scores-template.json` for manual fill-in
3. `avg()` inline function — computes mean of a score array

**Depth ratio:** ~5 / 1 = **5.0 — ADEQUATE**

The normalization formula `(score - 1) / 4` is internal. The dual-shape raw output reader (flat array vs `{results:[...]}`) handles a legacy format internally — a good example of absorbing backward compatibility complexity behind the interface.

---

### `icp-loop.mjs` (generated, icp-loop mode only)

**Path:** `scenarios/[name]/evals/icp-loop.mjs`

**Public interface (1):**
- CLI: `bun icp-loop.mjs --version vNNN [--batch N]`

**Internal functions (3):**
1. `callFlex(systemPrompt, userMessage, retries)` — Anthropic Flex API call with retry
2. `classifyOne(gt)` — calls model, extracts JSON, separates reasoning from JSON response
3. Interactive review loop — `readline` interface, per-company accept/correct prompts, correction accumulation

**Depth ratio:** 3 / 1 = **3.0 — ADEQUATE**

The gate logic (clean_rounds vs clean_rounds_required) and state persistence are internal. The batch-index wraparound logic is non-trivial but hidden behind the `--batch N` interface.

---

### `setup.test.mjs`

**Path:** `C:\Users\mitch\Everything_CC\auto-prompt-creator\setup.test.mjs`

**Public surface:** 8 test cases (via `bun:test`)

**Internal helpers (3):**
1. `runSetup(args)` — spawns `setup.mjs` synchronously, tracks created scenarios for cleanup
2. `scenarioPath(name)` — resolves scenario directory path
3. `readJSON(name, ...parts)` — reads and parses a JSON file within a scenario

**Depth ratio:** 3 / 8 = **0.4 — SHALLOW**

Expected for a test file — tests are intentionally transparent. The helper set is lean and appropriate. Verdict is not a concern here.
