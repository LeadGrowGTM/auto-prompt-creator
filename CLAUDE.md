# Auto Prompt Creator

A prompt optimization system that runs inside Claude Code sessions. Takes source inputs + desired output structure, uses Opus to generate ground truth, then iteratively refines a prompt for Haiku until it achieves 92%+ accuracy against that ground truth.

**Core Value:** A prompt produced by this system makes a cheap model (Haiku) produce outputs indistinguishable from a powerful model (Opus) for a specific, defined task.

## Constraints

- **Runtime**: Claude Code sessions only — no separate API keys, no external services
- **Target model**: Haiku 4.5 as the "stupid model" to optimize for
- **Accuracy threshold**: 92%+ before a prompt is considered "done"
- **Language style**: All outputs in normalized casual business language, not corporate/formal

## Conventions

### File Naming
- Prompt versions: `vNNN` zero-padded to 3 digits (v001, v002, ..., v015)
- Ground truth files: `{company-slug}.json` (lowercase, hyphenated)
- Raw outputs: `vNNN-raw.json` in `evals/`
- Scored results: `vNNN.json` in `evals/`
- Score templates: `vNNN-scores-template.json` in `evals/`

### Directory Structure
- `prompts/` — prompt versions (vNNN.md). NOT in evals/.
- `evals/` — runner, judge, loop state, raw outputs, scored results
- `ground-truth/` — expert reference outputs with train/val/holdout splits
- `inputs/` — staging area for raw inputs before ground truth generation
- `library/` — graduated prompts with YAML frontmatter metadata

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
- Weighted average across dimensions per rubric weights
- Split naming: "train", "val", "holdout" (not "validation")

### Mutation Types
- `additive` — add instructions or examples
- `structural` — reframe reasoning approach
- `targeted` — fix one specific failure
- `consolidation` — merge/tighten, reduce tokens
- `subtractive` — remove instructions, test if score holds

## Architecture

### System Components

| Component | Implementation | Purpose |
|---|---|---|
| Scenario setup | `setup.mjs` | Scaffolds directories, config, runner, judge |
| Prompt execution | `evals/run-eval.mjs` per scenario | Runs prompt against inputs via Haiku CLI |
| Scoring | `evals/judge.mjs` per scenario | Semi-auto: format check + score template. `--auto` for Opus judge |
| Loop state | `evals/loop-state.json` | Tracks iterations, scores, halt conditions, mutation history |
| Methodology | `METHODOLOGY.md` | Mutation diversity rules, phase constraints, generalization safeguards |
| Skill | `.claude/skills/anneal-prompt/SKILL.md` | Claude Code skill for guided/autonomous optimization |
| Library | `library/*.md` | Graduated prompts with accuracy metadata |

### Data Flow

```
inputs/ -> ground-truth/ (Opus generates, human validates)
prompts/v001.md -> run-eval.mjs -> evals/v001-raw.json
evals/v001-raw.json -> judge.mjs -> evals/v001.json
evals/v001.json -> failure analysis -> prompts/v002.md (mutation)
... repeat until halt ...
prompts/vNNN.md -> library/{scenario}.md (graduation)
```

### Runtime
- Bun 1.0+ (no Node.js)
- Claude CLI for model calls (`claude --print --model haiku|opus`)
- No external dependencies, no API keys beyond Claude Code session
