# Auto Prompt Creator

Prompt optimization system that runs inside Claude Code sessions. Takes source inputs + desired output structure, uses Opus to generate ground truth, then iteratively refines a prompt for a cheap model until it achieves 92%+ accuracy against that ground truth.

**Core Value:** A graduated prompt makes a cheap model (Haiku, gpt-4.1-mini) produce outputs indistinguishable from a powerful model (Opus) for a specific, defined task.

## Constraints

- **Runtime**: Claude Code sessions only — no separate API keys beyond what's in the environment
- **Target model**: Configurable per scenario (Haiku 4.5 via Claude CLI, or gpt-4.1-mini via OpenAI API) — not locked to one
- **Accuracy threshold**: 0.92 (92%) before a prompt is considered done
- **Language style**: All outputs in normalized casual business language, not corporate/formal

## Structure

Everything lives under `scenarios/[scenario-name]/`. Graduated prompts in `library/`. Methodology in `METHODOLOGY.md`. Scaffold new scenarios with `bun setup.mjs --name my-scenario`.

Part of LeadGrow workspace — see `../CLAUDE.md` for global rules.

## Conventions

- Prompt versions: `vNNN` zero-padded (v001, v002, ..., v015)
- Split naming: "train", "val", "holdout" (not "validation")
- Dimensions scored 1-5, normalized `(score - 1) / 4` to 0-1
- Mutation types: additive, structural, targeted, consolidation, subtractive

## Gotchas

- **Run-eval is scenario-scoped.** Each scenario has its own `run-eval.mjs` and `judge.mjs` — they know their own paths. Run from repo root with the full path.
- **Target model varies.** Some scenarios use `claude --print --model haiku` (Claude CLI), others use the OpenAI API with `gpt-4.1-mini`. Check `run-eval.mjs` before assuming.
- **`loop-state.json` is the loop's source of truth.** If `halt_reason` is not null, stop — don't mutate further. Check it before each iteration.
- **`scenario.json` defines the rubric.** It's created by `setup.mjs` and contains dimension weights, threshold, token budget, and max iterations. Edit it to change scoring.
- **Holdout is never touched during the loop.** Only train + val are used during optimization. Holdout scores only at graduation.
- **Read METHODOLOGY.md before running the loop.** Mutation diversity rules prevent the optimizer from gaming its own test set. Violations produce prompts that overfit and fail in production.
- **Runtime is Bun.** Use `bun`, not `node`. Scripts use `#!/usr/bin/env bun`.
