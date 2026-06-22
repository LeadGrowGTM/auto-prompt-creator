# Deepening Opportunities

Concrete improvements to reduce leaky abstractions, improve testability, and simplify interfaces.

---

## 1. Generated eval scripts cannot be unit-tested

**Problem:** `run-eval.mjs` and `judge.mjs` are string literals inside `setup.mjs`. They are generated once and then live as scenario-specific files. No test coverage exists for the scoring logic in `judge.mjs` (normalization formula, per-split averaging, dual-shape raw file reading). If the normalization formula `(score - 1) / 4` is wrong, no test catches it.

**Proposed Solution:** Extract the scoring logic into a standalone `lib/score.mjs` module in the repo root. The generated `judge.mjs` imports it. The test suite can test `lib/score.mjs` directly.

```js
// lib/score.mjs
export function normalizeScore(raw) { return (raw - 1) / 4; }
export function weightedAverage(scores, rubric) { ... }
export function splitAverages(perInput) { ... }
```

**Impact:** HIGH — the scoring math is the core correctness guarantee of the entire system. A bug here silently produces wrong scores, wrong graduation decisions, wrong halt triggers.

---

## 2. `callClaude` / `callFlex` duplicated across generated scripts

**Problem:** Every generated `run-eval.mjs` and `icp-loop.mjs` contains its own copy of the Anthropic API fetch function with retry logic. A bug fix or API change requires finding and patching every generated file in every scenario.

**Proposed Solution:** Extract to `lib/anthropic-client.mjs` at repo root. Generated scripts import it.

```js
// lib/anthropic-client.mjs
export async function callAnthropic(apiKey, model, system, user, opts = {}) { ... }
```

**Impact:** MEDIUM — reduces maintenance surface when the API version or service_tier handling changes. The current duplication is low-risk while the API is stable, but becomes a problem at the next `anthropic-version` bump.

---

## 3. Token estimation leaks through the eval runner interface

**Problem:** `run-eval.mjs` computes an estimated token count from a whitespace-split word count (`Math.ceil(words * 1.3)`). This estimate is printed to stdout and compared against `token_budget`, but the estimation method is inconsistent with how the halt condition works: `loop-state.json` records the actual token count logged by the previous iteration, not this estimate. The leaky abstraction means the console shows a different number than what triggers the halt.

**Proposed Solution:** Either (a) use the actual `usage.input_tokens` from the Anthropic API response (already available in the response JSON) and write it to the raw output file, or (b) document clearly that the printed estimate is advisory-only and the halt condition uses a separate counter. Currently neither is done.

**Impact:** MEDIUM — misleads developers debugging token-budget halts. Low defect risk in production scenarios, but confusing in practice.

---

## 4. `loop-state.json` is written by agents, not by scripts

**Problem:** Neither `run-eval.mjs` nor `judge.mjs` updates `loop-state.json`. The state update (adding to `score_history`, checking halt conditions, updating `consecutive_plateaus`) is performed manually by the Claude Code agent following METHODOLOGY.md rules. This makes the halt logic non-deterministic and impossible to test — it depends on the agent reading and correctly applying the rules.

**Proposed Solution:** Add a `bun update-loop-state.mjs --version vNNN` script that reads `vNNN.json` (the scored output) and applies halt condition logic to `loop-state.json`. This makes the state machine deterministic and testable.

```bash
bun scenarios/[name]/evals/update-loop-state.mjs --version v004
# → reads v004.json, computes halt conditions, writes loop-state.json
```

**Impact:** HIGH — the current design makes the most critical logic (halt decisions) unverifiable. An agent that misreads a plateau counter or overfitting gap will silently produce a bad graduation.

---

## 5. Scenario mode (`standard` vs `icp-loop`) is set at creation and cannot be changed

**Problem:** `setup.mjs` embeds the mode into the generated script filenames and `scenario.json`. There is no migration path if a scenario starts as `standard` and the user wants to switch to `icp-loop` mid-optimization.

**Proposed Solution:** Mode should be a runtime flag on `run-eval.mjs`, not a scaffolding decision. The icp-loop-specific state (`icp_loop` block in `loop-state.json`) can be added by `icp-loop.mjs` on first run if absent. This removes the need to choose at scaffold time.

**Impact:** LOW — the current approach works for the current use case. The limitation only matters if a scenario needs to switch modes, which hasn't happened yet. Flag for future work.

---

## 6. Version-specific eval scripts exist in production scenarios

**Problem:** `scenarios/icp-classification/evals/` contains `run-v001.mjs` and `run-vNNN.mjs` — exactly the anti-pattern prohibited by `METHODOLOGY.md` section "Parameterization". These are dead code that survived because no automated check enforces the prohibition.

**Proposed Solution:** Add a lint check to `setup.test.mjs` (or a separate `bun lint.mjs`) that scans all `scenarios/*/evals/` directories and fails if any file matches the pattern `run-v[0-9]+.mjs`. This turns the methodology rule into an enforceable invariant.

**Impact:** LOW — the files are harmless (not called by anything), but their existence signals rule drift and could confuse future contributors.
