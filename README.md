# Auto Prompt Creator

Takes a prompt that isn't performing well on a cheap model (Haiku) and iteratively optimizes it until it hits 92%+ accuracy against expert-quality ground truth.

**Core idea:** You define what good looks like (ground truth). The system figures out how to get Haiku to produce it consistently.

## Quickstart

### Option 1: Invoke the skill (recommended)

From any Claude Code session:

```
/anneal-prompt
```

Follow the prompts. It walks you through everything.

### Option 2: "This prompt sucks" — automatic invocation

When you're working and a prompt isn't performing, just say:

> "This prompt is falling short, anneal it"

Claude will spawn a subagent that sets up the scenario, runs the loop, and returns the optimized prompt.

### Option 3: Manual setup

```
bun auto-prompt-creator/setup.mjs --name my-scenario
```

Then edit the generated files and run the anneal loop skill.

## How It Works

```
 YOU DEFINE                    SYSTEM DOES                    YOU GET
+-----------+               +---------------+              +------------+
| Inputs    |               | Execute v001  |              | Graduated  |
| Output    | -- setup -->  | Score outputs | -- loop -->  | prompt     |
|  schema   |               | Analyze fails |              | in library/|
| Baseline  |               | Mutate prompt |              |            |
|  prompt   |               | Repeat x10    |              |            |
+-----------+               +---------------+              +------------+
```

### The Loop

1. Run your prompt against all test inputs via Haiku
2. Score each output against ground truth (rubric-weighted dimensions)
3. Analyze failure patterns — what specifically went wrong
4. Generate a mutation targeting the biggest failure
5. Check halt conditions (threshold reached, overfitting, convergence, token budget)
6. Repeat

### Mutation Phases (why this matters)

The optimizer follows three phases to prevent your prompt from becoming a lookup table:

| Phase | Iterations | Strategy |
|---|---|---|
| **Bootstrap** | 1-3 | Worked examples allowed. Teach the model the basic pattern. |
| **Generalize** | 4-7 | Examples blocked. Force structural reasoning improvements. |
| **Polish** | 8-10 | Subtractive encouraged. Remove noise, verify generalization. |

Without these constraints, the optimizer just keeps adding examples until it memorizes the test set. That scores well on eval and fails on real data.

## Setup a Scenario

### What you need

1. **A prompt** you want to optimize (the baseline)
2. **Test inputs** — 12-15 JSON files representing real-world cases
3. **An output schema** — what the output should look like
4. **A rubric** — dimensions to score on, with weights

### Directory structure

```
auto-prompt-creator/
  scenarios/
    your-scenario/
      scenario.json          # Config: rubric, threshold, token budget
      inputs/                # Input JSON files (12-15 recommended)
        company-a.json
        company-b.json
        ...
      ground-truth/          # Expert reference outputs (Opus-generated, human-validated)
        company-a.json
        company-b.json
        ...
      evals/                 # Generated during loop
        v001.md              # Baseline prompt
        run-eval.mjs         # Parameterized runner
        compute-scores.py    # Parameterized scorer
        loop-state.json      # Loop tracking
        v001-raw.json        # Raw Haiku outputs
        v001.json            # Scored results
      prompts/               # (optional) prompt archive
  library/                   # Graduated prompts land here
    your-scenario.md
  METHODOLOGY.md             # The rules — read this
```

### scenario.json

```json
{
  "name": "your-scenario",
  "description": "What task this prompt does",
  "model": "claude-haiku",
  "rubric": {
    "dimensions": {
      "accuracy": { "weight": 0.50, "description": "Is the output correct?" },
      "format": { "weight": 0.30, "description": "Does it match the schema?" },
      "style": { "weight": 0.20, "description": "Is the tone right?" }
    }
  },
  "accuracy_threshold": 0.92,
  "max_iterations": 10,
  "token_budget": 800,
  "overfitting_threshold": 0.12,
  "data_split": {
    "train": 0.60,
    "validation": 0.30,
    "holdout": 0.10
  },
  "mutation_phases": {
    "bootstrap": [1, 3],
    "generalize": [4, 7],
    "polish": [8, 10]
  },
  "example_cap_per_concept": 4
}
```

### Ground truth format

```json
{
  "id": "company-a",
  "split": "train",
  "input": { "company_name": "Acme Corp", "description": "..." },
  "ground_truth": { "field1": "value1", "field2": "value2" }
}
```

Split values: `"train"`, `"val"`, `"holdout"`. Holdout is only scored at graduation.

## Graduated Prompts

Optimized prompts land in `library/` with YAML frontmatter:

```yaml
---
scenario: your-scenario
graduated: 2026-04-06
accuracy:
  overall: 0.863
  train: 0.810
  validation: 0.928
  holdout: 0.910
threshold: 0.92
iterations: 9
best_version: v009
target_model: haiku
tokens: 648
generalization:
  holdout_val_gap: -0.018
  example_density: 0.006
  structural_ratio: 0.44
---
[The optimized prompt text]
```

## Key Concepts

**Mutation diversity** — The system enforces variety in how it improves the prompt. No 2 consecutive example-heavy mutations. Examples capped at 4 per concept. This prevents memorization.

**Train/val/holdout split** — Train failures drive mutations. Validation measures generalization. Holdout is the final exam at graduation. If holdout << val, the prompt memorized the eval set.

**Halt conditions** — The loop stops when: threshold reached (success), max iterations hit, scores plateau for 3 iterations, overfitting detected, or token budget exceeded.

**Subtractive validation** — At iteration 8, the system removes half the worked examples and re-scores. If the score holds, the reasoning instructions are strong. If it drops, the examples were doing the work.

## What makes a good scenario

- **Defined task** — clear input/output contract, not open-ended generation
- **Scorable output** — you can objectively compare against ground truth
- **Haiku-feasible** — the task is within Haiku's capability with the right prompt
- **Enough variance** — 12+ test cases covering edge cases, not just the happy path
