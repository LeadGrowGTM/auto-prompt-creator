<!-- GSD:project-start source:PROJECT.md -->
## Project

**Auto Prompt Creator**

A prompt optimization system that runs inside Claude Code sessions. Takes source inputs + desired output structure, uses Opus to generate ground truth, then iteratively refines a prompt for Haiku until it achieves 92%+ accuracy against that ground truth. Similar architecture to the research-process-builder's anneal loop but optimizing LLM prompts instead of search patterns.

**Core Value:** A prompt produced by this system makes a cheap model (Haiku) produce outputs indistinguishable from a powerful model (Opus) for a specific, defined task.

### Constraints

- **Runtime**: Claude Code sessions only — no separate API keys, no external services
- **Target model**: Haiku 4.5 as the "stupid model" to optimize for
- **Accuracy threshold**: 92%+ before a prompt is considered "done"
- **Language style**: All outputs in normalized casual business language, not corporate/formal
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive Summary
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
### 2. Few-Shot Example Bootstrapping (USE THIS)
### 3. Instruction Rewriting (USE SELECTIVELY)
### 4. Evolutionary Mutation/Crossover (DON'T USE)
### 5. TextGrad Gradient Descent (DON'T USE)
### 6. ADAS Meta-Agent Search (DON'T USE)
## Evaluation Approach
### LLM-as-Judge with Structured Rubric (USE THIS)
- Single holistic score (too noisy, hides which dimensions are failing)
- Likert scale without chain-of-thought (biased toward high scores)
- Pairwise comparison (we have ground truth, no need to compare two outputs)
## File Formats and Tracking
### Scenario Definition (Input)
# .scenarios/icp-classification/scenario.yaml
### Iteration Log (Tracking)
# .scenarios/icp-classification/iterations/003.yaml
### Prompt Version (Git-Tracked)
# .scenarios/icp-classification/prompts/v003.md
# ICP Classification Prompt v3
# Score: 0.87 | Parent: v2 | Mutation: append_rule
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
### 2. Composite scoring over single metric
### 3. Ground truth comparison over open-ended judging
### 4. Greedy hill-climbing over population-based search
### 5. YAML over JSON for experiment logs
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
