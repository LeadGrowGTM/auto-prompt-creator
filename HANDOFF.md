# Handoff — auto-prompt-creator ICP Loop Feature

**Date:** 2026-05-28  
**Branch:** master  
**Last commit:** 93c1abc (feat(45-01): create enrichment prompts + upgrade buying-signal-classifier)

---

## What Was Built

Added `--mode icp-loop` to `setup.mjs` — a human-in-the-loop prompt validation mode based on the "ICP prompt loop" workflow:

- Feed 10 companies at a time through the model (Flex tier)
- Model shows reasoning before each classification
- Human accepts or corrects inline
- Any correction resets the clean-round counter
- Gate clears after 3 consecutive clean batches → prompt is validated for full eval

### Files Changed

**`setup.mjs`** — single file modified. Changes:
1. Added `--mode standard|icp-loop` parseArgs option
2. `scenario.json` template gets `icp_loop` block when mode=icp-loop
3. `loop-state.json` template gets `icp_loop` state block when mode=icp-loop
4. `run-eval.mjs` template replaced: `claude --print` CLI → Anthropic REST API with `service_tier: "flex"`
5. New `icp-loop.mjs` template scaffolded when mode=icp-loop

### New scaffold files (generated per scenario)

| File | Purpose |
|------|---------|
| `evals/icp-loop.mjs` | Interactive 10-at-a-time review loop |
| `scenario.json` → `icp_loop` block | batch_size, clean_rounds_required, model |
| `loop-state.json` → `icp_loop` block | clean_rounds counter, gate_cleared flag, corrections_history |

---

## Key Design Decisions

- **Flex API everywhere** — `service_tier: "flex"` in all Anthropic calls (cheaper, lower priority, still synchronous). No Batch API async complexity.
- **Sonnet 4.6 for ICP loop** (validation), **Haiku for run-eval** (bulk scoring). Different models for different jobs.
- **Raw `fetch`** to Anthropic REST API — no SDK dependency, matches existing b2b-robotics-qualifier pattern.
- **Corrections saved to `icp-corrections-vNNN-batchN.json`** — human-readable, used as context when revising prompt to next version.
- **`judge.mjs` updated** — handles both flat array and `{results:[...]}` shaped raw files (backwards compat with b2b-robotics-qualifier output shape).

---

## Usage

```bash
# Create new scenario with ICP loop mode
bun setup.mjs --name my-icp-scenario --mode icp-loop --description "Classify companies into verticals"

# Run ICP loop
bun scenarios/my-icp-scenario/evals/icp-loop.mjs --version v001

# After gate clears → full eval
bun scenarios/my-icp-scenario/evals/run-eval.mjs --version v001
```

---

## What's Not Done / Next Steps

1. **`/anneal-prompt` skill** not updated to know about icp-loop mode — it still drives the standard anneal loop. Could add a check: if `scenario.json.icp_loop.enabled` and `gate_cleared === false`, surface a warning to run icp-loop first.
2. **Existing scenarios** (`icp-classification`, `prospect-identification`) still use old CLI-based `run-eval.mjs`. Not migrated — working, no need to break.
3. **Prompt revision step** is manual — user corrects batch, then manually writes next prompt version. Could add a `icp-loop.mjs --revise` flag that calls Opus with the corrections file to auto-draft the next prompt version.
4. **`b2b-robotics-qualifier`** is untracked in git — was pre-existing before this session, not touched.

---

## State of the Repo

```
M  setup.mjs          ← the one changed file
?? library/classifiers/saas-classifier.md
?? library/homepage-analysis.md
?? library/pvp-target-market-v1.md
?? library/signal-match-v2.md
?? scenarios/b2b-robotics-qualifier/
```

Nothing committed in this session. Changes are unstaged.
