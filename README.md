# Auto Prompt Creator

A prompt optimization system for Claude Code. Takes a prompt that doesn't perform well on a cheap model (Haiku), iteratively improves it through a scored anneal loop, and graduates it when it hits 92%+ accuracy against expert ground truth.

**The core problem:** Opus-quality prompts often fail on Haiku. Manual prompt tuning is slow, unscientific, and doesn't generalize. This system makes it measurable and repeatable.

**The core insight:** Specific worked examples are the fastest way to boost scores, but they're also the fastest way to overfit. The system enforces mutation diversity to ensure the prompt learns to *reason*, not *memorize*.

## Setup

### Requirements

- [Claude Code](https://claude.com/claude-code) (CLI, desktop app, or IDE extension)
- [Bun](https://bun.sh/) runtime (`curl -fsSL https://bun.sh/install | bash`)
- Git

### Installation

```bash
git clone https://github.com/MitchellkellerLG/auto-prompt-creator.git
cd auto-prompt-creator
```

No dependencies to install. The system runs entirely inside Claude Code sessions using Claude CLI for model calls.

### Add as Claude Code skill (optional)

If you want `/anneal-prompt` available globally, add this repo's `.claude/skills/` to your Claude Code configuration. The skill auto-registers when the repo is in your working directory.

## Quick Start

### 1. Create a scenario

```bash
bun setup.mjs --name customer-classifier \
  --description "Classify inbound leads by ICP fit" \
  --dimensions "accuracy:0.50,format:0.30,tone:0.20"
```

This creates:

```
scenarios/customer-classifier/
  scenario.json        # Rubric config (edit this)
  inputs/              # Your test cases go here (staging before ground truth)
  ground-truth/        # Expert reference outputs
  prompts/
    v001.md            # Paste your baseline prompt
  evals/
    loop-state.json    # Auto-managed
```

### 2. Add test data

**Inputs** (12-15 recommended) -- one JSON file per test case in `inputs/`:

```json
{
  "company_name": "Acme Corp",
  "description": "Acme manufactures precision widgets for automotive tier-1 suppliers..."
}
```

**Ground truth** -- matching files in `ground-truth/` with expert-validated outputs:

```json
{
  "id": "acme-corp",
  "split": "train",
  "input": { "company_name": "Acme Corp", "description": "..." },
  "ground_truth": { "classification": "strong", "reasoning": "B2B manufacturer with clear sales pain" }
}
```

Assign splits: 60% `train`, 30% `val`, 10% `holdout`. Holdout is never seen during the loop.

### 3. Paste your baseline prompt

Edit `scenarios/customer-classifier/prompts/v001.md` with the prompt you want to optimize.

### 4. Run the anneal loop

From a Claude Code session:

```
/anneal-prompt customer-classifier
```

Or just tell Claude: *"This prompt isn't working well on Haiku. Anneal it."*

The system runs up to 10 iterations, shows you the output table each time, and graduates the prompt to `library/` when it hits the accuracy threshold.

## How It Works

### The Anneal Loop

```
Analyze failures -> Select mutation -> Generate new prompt -> Execute on Haiku
      ^                                                            |
      |_____________ Score against ground truth ___________________|
```

Each iteration:
1. Execute the current prompt against all test inputs via Haiku
2. Score outputs against ground truth using a weighted rubric
3. Analyze failure patterns (what broke, how often, how bad)
4. Generate a mutation targeting the biggest failure
5. Check halt conditions

### Mutation Phases

This is the key innovation. Without constraints, the optimizer just adds examples until it memorizes the test set. These phases prevent that:

| Phase | Iterations | What's Allowed | Why |
|---|---|---|---|
| **Bootstrap** | 1-3 | All mutation types, examples encouraged | Teach the model the basic pattern fast |
| **Generalize** | 4-7 | Structural only, **examples blocked** | Force the model to reason, not pattern-match |
| **Polish** | 8-10 | All types, subtractive encouraged | Compress, remove noise, verify generalization |

**Hard rules:**
- Max 4 worked examples per concept
- No 2 consecutive example-heavy mutations
- Mandatory subtractive check at iteration 8 (remove half the examples, see if score holds)

### Halt Conditions

| Condition | Trigger | What It Means |
|---|---|---|
| Threshold reached | val >= 0.92 | Done. Graduate. |
| Max iterations | iteration >= 10 | Time's up. Graduate best if val > 0.80. |
| Convergence plateau | 3 val deltas < 0.02 | Stuck. Current approach exhausted. |
| Overfitting | train-val gap > 0.12 | Memorizing train set. Need structural change. |
| Token budget | tokens > 800 | Prompt too long. Need consolidation. |

### Graduation

When the loop halts successfully:
1. Best prompt scored against the **holdout set** (never seen during the loop)
2. Generalization metrics computed (holdout-val gap, example density, structural ratio)
3. If holdout-val gap > -0.08: graduated to `library/` with full metadata
4. If not: flagged as overfitted, needs rework

## Real Examples

### Example 1: ICP Classification

**Task:** Classify companies for B2B outbound fit (strong/moderate/weak).

**Baseline (v001):** Generic "classify this company" prompt. Val score: 0.622.

**Problem:** Haiku used corporate jargon, missed operational pain signals, confused SaaS with service companies.

**Result after 4 iterations:**

```
v001 -> val 0.622 | 267 tokens | baseline
v002 -> val 0.640 | 295 tokens | +casual language examples
v003 -> val 0.640 | 340 tokens | +pain point specificity rules
v004 -> val 0.925 | 388 tokens | consolidation (merged verbose rules)  <- graduated
```

**Key learning:** The consolidation mutation (v004) that *removed* complexity and *merged* rules produced the biggest single jump. Less was more.

**Graduated prompt:** `library/icp-classification.md` (388 tokens, val 0.925)

### Example 2: Prospect Identification

**Task:** Given a company description, identify their ideal customer business types and decision maker titles.

**Baseline (v001):** "Identify business types and decision makers." Val score: 0.563.

**Problem:** Haiku confused the company's own industry with their customer's industry. Said "metal fabricators" for a metal stamping company instead of "automotive OEMs."

**Result after 9 iterations:**

```
v001 -> val 0.563 | 364 tokens | baseline
v002 -> val 0.583 | 420 tokens | +3-question reasoning chain
v003 -> val 0.644 | 467 tokens | +buyer-not-seller negative example
v004 -> val 0.841 | 509 tokens | +budget-holder worked examples  <- breakthrough
v005 -> val 0.794 | 604 tokens | +train-specific examples (val dipped)
v006 -> val 0.806 | 668 tokens | +M&A context example
v007 -> val 0.863 | 695 tokens | +title normalization fixes
v008 -> val 0.906 | 683 tokens | +packaging domain refinement
v009 -> val 0.928 | 648 tokens | consolidation + mirror rule  <- graduated
```

**Key learning:** Specific worked examples (v004) produced the biggest single gain (+0.20 val). But 60% of mutations were example-based, which is why v2 of the methodology now blocks examples in iterations 4-7. The structural mutations (v003's buyer reframe, v009's mirror rule) were the ones that actually generalized.

**Graduated prompt:** `library/prospect-identification.md` (648 tokens, val 0.928)

## Scenario Configuration

### scenario.json reference

```json
{
  "name": "your-scenario",
  "description": "What task this prompt performs",
  "model": "claude-haiku",
  "rubric": {
    "dimensions": {
      "dimension_name": {
        "weight": 0.50,
        "description": "What this dimension measures"
      }
    }
  },
  "accuracy_threshold": 0.92,
  "max_iterations": 10,
  "token_budget": 800,
  "overfitting_threshold": 0.12,
  "data_split": {
    "train": 0.60,
    "validation": 0.30,
    "holdout": 0.10,
    "min_examples": 12,
    "recommended_examples": 15
  },
  "mutation_phases": {
    "bootstrap": [1, 3],
    "generalize": [4, 7],
    "polish": [8, 10]
  },
  "example_cap_per_concept": 4
}
```

### Rubric design tips

- **Weight the hardest dimension highest.** If accuracy is the bottleneck, weight it 0.50+.
- **Keep dimensions orthogonal.** "accuracy" and "correctness" measure the same thing.
- **3-4 dimensions is the sweet spot.** More than 5 dilutes the signal.
- **Description matters.** The judge uses it to score. Be specific about what 5/5 vs 1/5 looks like.

### Data selection tips

- **Include your failures.** The cases where the prompt breaks are the most valuable test data.
- **Vary difficulty.** Easy cases catch regressions. Hard cases drive improvement.
- **Real data only.** Synthetic test cases optimize for synthetic patterns.
- **Holdout must be hard.** Put at least one edge case in holdout that doesn't match any worked example.

## File Structure

```
auto-prompt-creator/
  .claude/
    skills/
      anneal-prompt/
        SKILL.md             # The skill (auto-registers in Claude Code)
  scenarios/
    [scenario-name]/
      scenario.json          # Config: rubric, thresholds, mutation rules
      inputs/                # Test case JSON files
      ground-truth/          # Expert reference outputs with train/val/holdout splits
      prompts/
        v001.md - vNNN.md    # Prompt versions (the thing being optimized)
      evals/
        loop-state.json      # Iteration tracking, scores, halt state
        run-eval.mjs         # Parameterized runner (calls Haiku via Claude CLI)
        judge.mjs            # Semi-automated scorer (format check + score template)
        vNNN-raw.json        # Raw model outputs per version
        vNNN.json            # Scored results per version
  library/                   # Graduated prompts with accuracy metadata
    icp-classification.md    # Example: val 0.925, 4 iterations
    prospect-identification.md  # Example: val 0.928, 9 iterations
  setup.mjs                  # Scenario scaffolding script
  METHODOLOGY.md             # Mutation diversity rules and generalization safeguards
  README.md                  # You are here
```

## Design Philosophy

**Teach reasoning, not memorization.** A prompt full of worked examples that map 1:1 to the test set will score well on eval and fail on real data. The mutation phase system ensures the optimizer builds generalizable reasoning instructions, not a lookup table.

**Measure everything.** Every iteration is scored. Every mutation is logged. Every version is diffable. No "I think this prompt is better" -- the numbers tell you.

**Human sets quality, machine optimizes speed.** Ground truth is human-validated. The rubric is human-designed. The mutation loop is automated. The human reviews outputs at baseline and at graduation.

**Subtractive proves generalization.** If you can remove half the examples and the score holds, the reasoning instructions are carrying the weight. If the score drops, you're memorizing. The mandatory subtractive check at iteration 8 catches this.
