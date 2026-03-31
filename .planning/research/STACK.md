# Technology Stack

**Project:** Auto Prompt Creator
**Researched:** 2026-03-30

## Executive Summary

The prompt optimization landscape in 2025-2026 is dominated by DSPy (Stanford), TextGrad (Stanford/Nature), and evolutionary approaches (EvoPrompt, PromptBreeder). Every single one of these is a Python framework that calls LLM APIs directly. None of them run inside Claude Code sessions.

This means we don't adopt any of these frameworks wholesale. Instead, we extract the proven algorithmic patterns and implement them as a file-based methodology that CC executes. The good news: the core loop is simple. The hard part these frameworks solve (API orchestration, parallelism, caching) is already solved by CC's agent spawning.

## The Landscape: What Exists

### Tier 1: Production-Ready Frameworks

| System | Origin | Approach | Key Innovation | Confidence |
|--------|--------|----------|----------------|------------|
| **DSPy** | Stanford NLP | Signature compilation | Separates "what" (signatures) from "how" (optimizers). MIPROv2 + SIMBA optimizers. | HIGH |
| **TextGrad** | Stanford/Nature | Gradient-based via text | Treats LLM feedback as "gradients" for backpropagation through text. Published in Nature. | HIGH |

### Tier 2: Research Systems

| System | Origin | Approach | Key Innovation | Confidence |
|--------|--------|----------|----------------|------------|
| **EvoPrompt** | ICLR 2024 | Evolutionary algorithms | Population of prompts + mutation/crossover operators via LLM | HIGH |
| **PromptBreeder** | DeepMind | Self-referential evolution | Evolves both task prompts AND mutation operators simultaneously | MEDIUM |
| **ADAS** | ICLR 2025 | Meta-agent search | Agents that program better agents in code; learns workflows not just prompts | HIGH |
| **APE** | Zhou et al. | Generate-and-select | LLM generates instruction candidates, scores them, picks best | HIGH |

### Tier 3: Evaluation Frameworks (Not Optimizers)

| System | Purpose | Relevance |
|--------|---------|-----------|
| **G-Eval** | LLM-as-judge with chain-of-thought scoring | Directly applicable to our judge design |
| **Promptfoo** | CLI for prompt testing/comparison | File format patterns worth studying |

## Prompt Mutation Strategies (Ranked by Relevance)

### 1. SIMBA Self-Reflective Rules (USE THIS)

**What:** Run prompt on mini-batch, identify hard examples (high output variability), ask LLM to self-reflect: "what went wrong? what rule would fix this?" Append rule to prompt.

**Why this is our core strategy:** It maps perfectly to CC. No API orchestration needed. Opus looks at Haiku failures, generates a rule ("When the company description mentions both B2B and B2C, classify based on the primary revenue stream"), appends it to the prompt. Next iteration tests whether the rule helped.

**Algorithm (adapted for CC):**
1. Run candidate prompt on N examples via Haiku agent
2. Score each output against ground truth via Opus judge
3. Sort by score -- focus on failures and near-misses
4. Opus analyzes failure patterns: "What went wrong? What rule would prevent this?"
5. Generate improved prompt with new rule appended
6. Re-evaluate on same examples + fresh examples
7. Keep if score improves, discard if not

**Confidence:** HIGH -- this is DSPy's newest optimizer and it's designed for exactly this: introspective improvement with small datasets.

### 2. Few-Shot Example Bootstrapping (USE THIS)

**What:** Run prompt on training data. When output is correct, save the input/output pair as a few-shot example. Add best examples to prompt.

**Why:** Complements rule-based mutation. Some tasks improve more from examples than instructions. Our system should track which examples are "canonical" and include them.

**Algorithm (adapted for CC):**
1. Run prompt on training examples
2. When Haiku output scores 95%+ against ground truth, save as candidate few-shot
3. Select diverse few-shot examples (cover different edge cases)
4. Test prompt with few-shot examples vs without
5. Keep whichever scores higher

**Confidence:** HIGH -- BootstrapFewShot is DSPy's most battle-tested optimizer.

### 3. Instruction Rewriting (USE SELECTIVELY)

**What:** Generate N alternative phrasings of the instruction. Test each. Keep best. (COPRO/MIPROv2 approach)

**Why selectively:** Full Bayesian optimization over instruction space (MIPROv2) requires 40+ trials with 200+ examples. Overkill for our use case. But generating 3-5 alternative phrasings of a failing instruction section is cheap and effective.

**Confidence:** HIGH for the concept, MEDIUM for our constrained implementation.

### 4. Evolutionary Mutation/Crossover (DON'T USE)

**What:** Maintain population of prompts. Cross-breed top performers. Mutate randomly. (EvoPrompt, PromptBreeder)

**Why not:** Requires large populations (10-50 prompts) and many generations. Each generation means running all prompts against all examples. In CC, each run costs real session time and context. The SIMBA approach achieves similar results with far fewer iterations by being targeted rather than random.

**Confidence:** HIGH that this is wrong for our constraints.

### 5. TextGrad Gradient Descent (DON'T USE)

**What:** Treat LLM critique as "textual gradients." Backpropagate critique through computation graph to improve each component.

**Why not:** Elegant for compound AI systems with multiple chained components. We're optimizing a single prompt for a single model call. TextGrad's graph-based approach adds complexity without benefit. The SIMBA "analyze failures, generate rules" approach achieves the same thing more directly.

**Confidence:** HIGH that this is wrong for our use case.

### 6. ADAS Meta-Agent Search (DON'T USE)

**What:** Meta-agent programs new agents in code, tests them, archives discoveries. Learns entire workflows, not just prompts.

**Why not:** Fascinating research but wildly overscoped. We're optimizing a prompt string, not designing agent architectures. ADAS optimizes code; we optimize natural language instructions.

**Confidence:** HIGH that this is wrong for our scope.

## Evaluation Approach

### LLM-as-Judge with Structured Rubric (USE THIS)

**Pattern from G-Eval + DSPy metrics:**

1. **Dimension scoring:** Break evaluation into independent dimensions. For ICP classification: field accuracy, label normalization, completeness, edge case handling.
2. **Chain-of-thought judging:** Judge prompt asks Opus to reason step-by-step before scoring. Reduces scoring bias.
3. **Binary + scaled hybrid:** Some dimensions are binary (field present/absent), others are scaled (0-4 for label quality). Combine into weighted composite score.
4. **Ground truth comparison, not open-ended quality:** Our judge compares Haiku output to Opus ground truth, not evaluating quality in a vacuum. This is much more reliable than open-ended LLM-as-judge.

**Anti-patterns to avoid:**
- Single holistic score (too noisy, hides which dimensions are failing)
- Likert scale without chain-of-thought (biased toward high scores)
- Pairwise comparison (we have ground truth, no need to compare two outputs)

**Confidence:** HIGH -- ground truth comparison is strictly more reliable than open-ended judging.

## File Formats and Tracking

### Scenario Definition (Input)

```yaml
# .scenarios/icp-classification/scenario.yaml
name: icp-classification
description: Classify company ICP from description
target_model: haiku
judge_model: opus
accuracy_threshold: 0.92

ground_truth_prompt: |
  # Generate ground truth prompt (run by Opus)
  [Opus-quality prompt for generating ideal output]

candidate_prompt: |
  # Current best candidate (run by Haiku)
  [The prompt being optimized]

rubric:
  dimensions:
    - name: field_accuracy
      weight: 0.4
      type: binary_per_field
      description: "Each output field matches ground truth semantically"
    - name: label_normalization
      weight: 0.3
      type: scaled_0_4
      description: "Labels use casual business language, not corporate jargon"
    - name: completeness
      weight: 0.2
      type: binary
      description: "All expected fields present"
    - name: edge_cases
      weight: 0.1
      type: scaled_0_4
      description: "Handles ambiguous inputs gracefully"

examples:
  - input_file: examples/acme-corp.md
  - input_file: examples/startup-xyz.md
  - input_file: examples/enterprise-co.md
```

### Iteration Log (Tracking)

```yaml
# .scenarios/icp-classification/iterations/003.yaml
iteration: 3
timestamp: 2026-03-30T14:22:00Z
parent: 2
mutation_type: append_rule
mutation_description: "Added rule for B2B/B2C hybrid companies"

scores:
  composite: 0.87
  field_accuracy: 0.90
  label_normalization: 0.82
  completeness: 0.95
  edge_cases: 0.75

failures:
  - example: enterprise-co.md
    dimension: label_normalization
    expected: "enterprise SaaS"
    got: "Enterprise Software-as-a-Service"
    analysis: "Haiku reverted to formal language despite normalization rule"

  - example: startup-xyz.md
    dimension: edge_cases
    expected: "pre-revenue / too early to classify"
    got: "SMB tech startup"
    analysis: "Missing rule for handling pre-revenue companies"

prompt_diff: |
  + Rule: When a company description mentions both B2B and B2C revenue,
  + classify based on the PRIMARY revenue stream (>60% of revenue).
  + If unclear, note "hybrid" rather than forcing a single classification.

next_mutations:
  - type: append_rule
    target: label_normalization
    hypothesis: "Add explicit examples of casual vs formal labels"
  - type: append_rule
    target: edge_cases
    hypothesis: "Add rule for pre-revenue / insufficient data companies"
```

### Prompt Version (Git-Tracked)

```
# .scenarios/icp-classification/prompts/v003.md
# ICP Classification Prompt v3
# Score: 0.87 | Parent: v2 | Mutation: append_rule

[Full prompt text here, diffable via git]
```

This structure means:
- **scenario.yaml** is the configuration (what we're optimizing)
- **iterations/NNN.yaml** is the experiment log (what happened)
- **prompts/vNNN.md** is the artifact (the actual prompt, git-diffable)
- **examples/** holds the test data
- **ground_truth/** holds Opus-generated reference outputs

## Recommended Stack (What We Actually Build)

### Core Components

| Component | Implementation | Purpose | Why |
|-----------|---------------|---------|-----|
| Scenario runner | CC skill (SKILL.md) | Orchestrates the optimization loop | CC is the runtime; skill defines the methodology |
| Ground truth generator | Opus (current session) | Produces reference outputs from examples | Opus is already running; no API cost |
| Candidate executor | Haiku (spawned agent) | Runs candidate prompts against examples | Agent spawning gives us model routing for free |
| Judge | Opus (current session) | Scores Haiku output vs ground truth | Same Opus session, structured rubric |
| Mutation engine | Opus (current session) | Analyzes failures, generates prompt improvements | SIMBA-style self-reflection |
| Iteration tracker | YAML files + git | Records scores, failures, mutations per iteration | File-based, diffable, zero infrastructure |

### Supporting Patterns

| Pattern | Implementation | Purpose |
|---------|---------------|---------|
| Prompt versioning | Git commits on prompt files | Full history, rollback, diff |
| Experiment logging | YAML iteration files | Structured, queryable, human-readable |
| Ground truth caching | Markdown files per example | Generate once, reuse across iterations |
| Failure analysis | Structured YAML in iteration log | Feeds mutation engine |

### What We Do NOT Need

| Thing | Why Not |
|-------|---------|
| Python runtime | CC is the runtime |
| DSPy / TextGrad packages | We extract patterns, not dependencies |
| Database | YAML + git is sufficient for <100 iterations |
| API keys | CC handles model access |
| Bayesian optimization (Optuna) | Overkill; SIMBA's targeted approach works with fewer trials |
| Population-based evolution | Too many iterations for CC session constraints |
| Vector embeddings for similarity | Opus judge handles semantic comparison natively |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Mutation strategy | SIMBA self-reflection | EvoPrompt evolution | Too many iterations, random vs targeted |
| Evaluation | Ground truth + rubric | Open-ended LLM judge | Ground truth is strictly more reliable |
| Tracking format | YAML + git | SQLite / JSON | YAML is human-readable, git gives versioning free |
| Optimization search | Greedy hill-climbing | Bayesian (MIPROv2) | Needs 40+ trials; we target <15 iterations |
| Runtime | Claude Code agents | Python CLI + API | Project constraint; CC is the engine |

## Key Architectural Decisions

### 1. SIMBA-style over MIPROv2-style

MIPROv2 needs 200+ examples and 40+ trials with Bayesian optimization. SIMBA works with 10-50 examples and converges in 5-15 iterations by being targeted (analyze failures, generate rules) rather than exploratory (random search). Given CC session constraints, SIMBA's approach is clearly superior.

### 2. Composite scoring over single metric

Every prompt optimization system that works uses multi-dimensional scoring. A single "accuracy" number hides which aspects are failing. Our rubric breaks scoring into weighted dimensions so the mutation engine knows WHERE to focus.

### 3. Ground truth comparison over open-ended judging

Open-ended LLM-as-judge has well-documented scoring biases (position bias, verbosity bias, self-enhancement bias). Comparing against a known-good reference output is far more reliable. We have Opus to generate that reference. Use it.

### 4. Greedy hill-climbing over population-based search

Each iteration in CC costs real time (agent spawning, evaluation). Population-based approaches need 10-50x more evaluations. Greedy hill-climbing (keep the best, try to beat it) converges fast enough when guided by failure analysis.

### 5. YAML over JSON for experiment logs

Human readability matters. These files will be read by Opus during failure analysis. YAML with multi-line strings is more natural than escaped JSON. Git diff is cleaner on YAML.

## Sources

- [DSPy Optimizers Overview](https://dspy.ai/learn/optimization/optimizers/) -- HIGH confidence
- [DSPy MIPROv2 Documentation](https://dspy.ai/api/optimizers/MIPROv2/) -- HIGH confidence
- [DSPy SIMBA Documentation](https://dspy.ai/api/optimizers/SIMBA/) -- HIGH confidence
- [DSPy SIMBA Explained (Marius Vach)](https://blog.mariusvach.com/posts/dspy-simba) -- MEDIUM confidence
- [TextGrad: Automatic Differentiation via Text (Nature)](https://arxiv.org/abs/2406.07496) -- HIGH confidence
- [TextGrad GitHub](https://github.com/zou-group/textgrad) -- HIGH confidence
- [EvoPrompt (ICLR 2024)](https://arxiv.org/abs/2309.08532) -- HIGH confidence
- [ADAS: Automated Design of Agentic Systems (ICLR 2025)](https://arxiv.org/abs/2408.08435) -- HIGH confidence
- [APE: Automatic Prompt Engineer](https://arxiv.org/abs/2211.01910) -- HIGH confidence
- [Systematic Survey of Automatic Prompt Optimization (EMNLP 2025)](https://aclanthology.org/2025.emnlp-main.1681.pdf) -- HIGH confidence
- [LLM-as-a-Judge Best Practices (Monte Carlo Data)](https://www.montecarlodata.com/blog-llm-as-judge/) -- MEDIUM confidence
- [G-Eval: LLM-as-Judge with CoT](https://www.evidentlyai.com/llm-guide/llm-as-a-judge) -- MEDIUM confidence
- [Promptfoo LLM Rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/) -- MEDIUM confidence
