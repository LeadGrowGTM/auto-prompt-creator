# Automation Recommendations

Recommended Claude Code automations for the `auto-prompt-creator` repo.

---

## Pre-commit Hooks

### 1. Run `setup.test.mjs` before every commit

**What:** `bun test setup.test.mjs` (and `bun test __tests__/`) as a pre-commit hook.

**Why it helps:** The test suite catches regressions in `setup.mjs` scaffold output before they land in main. A broken scaffold produces silent failures — the scenario directory is created but with wrong structure, and that only surfaces when the eval runner is run later.

**Implementation sketch:**
```bash
# .husky/pre-commit or .git/hooks/pre-commit
bun test setup.test.mjs __tests__/scoring.test.mjs
```
Add via `setup-pre-commit` skill or write the hook file directly.

---

### 2. Lint for version-specific eval scripts

**What:** Check that no `scenarios/*/evals/run-v[0-9]*.mjs` files exist (METHODOLOGY.md anti-pattern).

**Why it helps:** The icp-classification scenario already has `run-v001.mjs` and `run-vNNN.mjs` in violation of the "no version-specific scripts" rule. A lint check turns this into an enforced invariant rather than a documentation rule.

**Implementation sketch:**
```bash
# In pre-commit hook, after tests:
if ls scenarios/*/evals/run-v[0-9]*.mjs 2>/dev/null | grep -q .; then
  echo "ERROR: Version-specific eval scripts found. Use run-eval.mjs --version vNNN instead."
  exit 1
fi
```

---

### 3. Type-check scenario JSON files on commit

**What:** Validate that all `scenarios/*/scenario.json` files have the required fields (`name`, `rubric.dimensions`, `accuracy_threshold`, `token_budget`, `max_iterations`, `mutation_phases`).

**Why it helps:** Manually edited `scenario.json` files can drop required fields that the anneal loop silently reads as `undefined`. Catching malformed config at commit time prevents corrupted loop runs.

**Implementation sketch:**
```bash
bun scripts/validate-scenario-configs.mjs  # (script to create)
```

---

## Skills That Would Benefit Development

### 4. `anneal-prompt` skill (already exists)

**Path:** `.claude/skills/anneal-prompt/SKILL.md`

**What:** The existing skill drives the autonomous optimization loop — analyze failures, select mutation, generate next prompt version, check halt conditions.

**Why relevant here:** This is the primary skill for this repo. Ensure it is loaded when opening a Claude Code session in this repo. Verify the skill reads `METHODOLOGY.md` and `loop-state.json` before each iteration.

---

### 5. `tdd` skill for test-first mutation development

**What:** When adding new mutation types or new scenario modes to `setup.mjs`, the `tdd` skill enforces writing a failing test in `setup.test.mjs` first.

**Why it helps:** The existing test suite is black-box and comprehensive. New features added without tests have no coverage. The `tdd` skill keeps the test-first discipline when extending the scaffolder.

---

### 6. `code-review` skill before merging scenario config changes

**What:** Run `/code-review` on any PR that modifies `METHODOLOGY.md` or `scenario.json` defaults in `setup.mjs`.

**Why it helps:** Methodology changes (e.g. changing bootstrap phase from iterations 1-3 to 1-4) have downstream effects on all future scenarios. A quick review catches unintended constraint relaxations.

---

## MCP Server Connections

### 7. No MCP servers needed for core workflow

The eval loop uses the Anthropic REST API directly via `fetch` in `run-eval.mjs` — no MCP needed. The `ANTHROPIC_API_KEY` is read from the Bun environment.

If the repo is extended to support OpenAI models (some scenarios use `gpt-4.1-mini` per CLAUDE.md), the existing env-based pattern applies: read `OPENAI_API_KEY` from environment, no MCP required.

---

## Custom Agents for Common Tasks

### 8. `loop-runner` agent

**What:** An agent that runs one full anneal iteration end-to-end: read `loop-state.json`, execute `run-eval.mjs`, execute `judge.mjs --auto`, update `loop-state.json`, print summary table.

**Why it helps:** Currently the human (or Claude Code session) orchestrates these three steps manually. An agent that encapsulates the loop step removes the coordination overhead and ensures `loop-state.json` is always updated after scoring.

**Implementation sketch:**
```
Agent reads: scenarios/[name]/evals/loop-state.json
Agent runs:  bun scenarios/[name]/evals/run-eval.mjs --version vNNN
Agent runs:  bun scenarios/[name]/evals/judge.mjs --version vNNN --auto
Agent writes: loop-state.json (score_history, halt_check)
Agent prints: iteration summary table
```

---

### 9. `graduation-checker` agent

**What:** After `halt_reason: "threshold-reached"` is set, this agent runs the holdout eval and generates the graduation report (holdout-val gap, example density, structural ratio).

**Why it helps:** The graduation step is the most consequential and the most likely to be skipped when a developer is excited that the loop hit 0.92. An agent that auto-triggers on `halt_reason` being set ensures the holdout check always happens.

---

## File Watchers / Background Automations

### 10. Watch `loop-state.json` for halt condition

**What:** A file watcher that monitors `scenarios/*/evals/loop-state.json`. When `halt_reason` becomes non-null, send a desktop notification or terminal alert.

**Why it helps:** The anneal loop can run unattended (via `--auto` judge). When it halts, the developer needs to know to run the holdout check. A watcher removes the need to poll `loop-state.json` manually.

**Implementation sketch:**
```bash
# Using Bun's file watching
bun watch-halt.mjs  # polls loop-state.json every 30s, notifies on halt
```

Or use the `Monitor` tool from Claude Code to stream changes to `loop-state.json`.
