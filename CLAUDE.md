# Auto Prompt Creator

Prompt optimization system that runs inside Claude Code sessions. Takes source inputs + desired output structure, uses Opus to generate ground truth, then iteratively refines a prompt for a cheap model until it achieves 92%+ accuracy against that ground truth.

**Core Value:** A graduated prompt makes a cheap model (Haiku, gpt-4.1-mini) produce outputs indistinguishable from a powerful model (Opus) for a specific, defined task.

## Constraints

- **Runtime**: Claude Code sessions only — no separate API keys beyond what's in the environment
- **Target model**: Configurable per scenario (Haiku 4.5 via Claude CLI, or gpt-4.1-mini via OpenAI API) — not locked to one
- **Accuracy threshold**: 0.92 (92%) before a prompt is considered done
- **Language style**: All outputs in normalized casual business language, not corporate/formal

## Real Directory Structure

Everything lives under `scenarios/[scenario-name]/`. There are no flat top-level `prompts/`, `evals/`, or `ground-truth/` dirs.

```
scenarios/
  [scenario-name]/
    prompts/          # vNNN.md prompt versions
    evals/
      run-eval.mjs    # runs prompt against inputs via model CLI
      judge.mjs       # semi-auto scoring (--auto for Opus judge)
      loop-state.json # tracks iterations, scores, halt conditions
      vNNN-raw.json   # raw outputs per run
      vNNN.json       # scored results
      vNNN-scores-template.json  # fill-in template for manual scoring
    ground-truth/     # {company-slug}.json files (train/val/holdout split)
    inputs/           # raw inputs before ground truth generation
    scenario.json     # rubric, threshold, token budget, max iterations
    README.md         # status tracker with score table per version
    SKILL.md          # optional: scenario-specific anneal loop skill
    generate-gt.mjs   # optional: ground truth generator script

library/              # root-level — graduated prompts with YAML frontmatter metadata
METHODOLOGY.md        # mutation diversity rules, phase constraints, generalization safeguards
setup.mjs             # scaffolds a new scenario directory
.claude/skills/anneal-prompt/SKILL.md  # Claude Code skill for optimization
```

## Common Commands

```bash
# Create a new scenario
bun setup.mjs --name my-scenario
bun setup.mjs --name my-scenario --dimensions "accuracy:0.5,format:0.3,style:0.2" --threshold 0.92

# Run eval for a specific prompt version
bun scenarios/[name]/evals/run-eval.mjs --version v001
bun scenarios/[name]/evals/run-eval.mjs --version v001 --split val
bun scenarios/[name]/evals/run-eval.mjs --version v001 --split holdout

# Score outputs
bun scenarios/[name]/evals/judge.mjs --version v001              # emit score template (manual)
bun scenarios/[name]/evals/judge.mjs --version v001 --finalize   # combine filled template -> vNNN.json
bun scenarios/[name]/evals/judge.mjs --version v001 --auto       # Opus auto-score (3x median)
```

## Conventions

### File Naming
- Prompt versions: `vNNN` zero-padded to 3 digits (v001, v002, ..., v015)
- Ground truth files: `{company-slug}.json` (lowercase, hyphenated)
- Raw outputs: `vNNN-raw.json` in `evals/`
- Scored results: `vNNN.json` in `evals/`
- Score templates: `vNNN-scores-template.json` in `evals/`
- Library graduates: `library/{scenario-name}.md` with YAML frontmatter

### Ground Truth Format
```json
{
  "id": "slug",
  "split": "train|val|holdout",
  "input": { ... },
  "ground_truth": { ... }
}
```

### Scoring
- Dimensions scored 1-5 (1=wrong, 5=exact match)
- Normalization: `(score - 1) / 4` maps 1-5 to 0-1
- Weighted average across dimensions per rubric weights in `scenario.json`
- Split naming: "train", "val", "holdout" (not "validation")

### Mutation Types
- `additive` — add instructions or examples
- `structural` — reframe reasoning approach
- `targeted` — fix one specific failure
- `consolidation` — merge/tighten, reduce tokens
- `subtractive` — remove instructions, test if score holds

## Data Flow

```
inputs/ -> ground-truth/ (Opus generates, human validates)
prompts/v001.md -> run-eval.mjs -> evals/v001-raw.json
evals/v001-raw.json -> judge.mjs -> evals/v001.json
evals/v001.json -> failure analysis -> prompts/v002.md (mutation)
... repeat until halt (92%+ on val, or max iterations) ...
prompts/vNNN.md -> library/{scenario}.md (graduation)
```

## Gotchas

- **Run-eval is scenario-scoped.** Each scenario has its own `run-eval.mjs` and `judge.mjs` — they know their own paths. Run from repo root with the full path.
- **Target model varies.** Some scenarios use `claude --print --model haiku` (Claude CLI), others use the OpenAI API with `gpt-4.1-mini`. Check `run-eval.mjs` before assuming.
- **`loop-state.json` is the loop's source of truth.** If `halt_reason` is not null, stop — don't mutate further. Check it before each iteration.
- **`scenario.json` defines the rubric.** It's created by `setup.mjs` and contains dimension weights, threshold, token budget, and max iterations. Edit it to change scoring.
- **Holdout is never touched during the loop.** Only train + val are used during optimization. Holdout scores only at graduation.
- **Read METHODOLOGY.md before running the loop.** Mutation diversity rules prevent the optimizer from gaming its own test set. Violations produce prompts that overfit and fail in production.
- **Runtime is Bun.** Use `bun`, not `node`. Scripts use `#!/usr/bin/env bun`.
