# Feature Landscape

**Domain:** Prompt optimization system (CC-native, file-based)
**Researched:** 2026-03-30

## Table Stakes

Features users expect. Missing = system doesn't work or isn't trustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Scenario definition files | Without structured input (source data + expected output shape + rubric), the system has nothing to optimize against. Every tool in the space starts here. | Low | YAML or structured markdown. Define: task description, input data, output schema, quality criteria. DSPy uses "signatures," Promptfoo uses YAML configs, Evidently uses Python objects. For CC-native: markdown + YAML frontmatter is the move. |
| Ground truth generation | The optimization loop needs a reference answer to score against. Opus-as-ground-truth is the core value prop. Without it, you're optimizing blind. | Medium | Opus generates "ideal" outputs for each test input. Store as versioned files alongside scenarios. This is what makes cheap-model optimization possible without human labeling. |
| Candidate prompt execution | Running the prompt-under-test against the target model (Haiku) and capturing structured output. The actual "run" step. | Medium | CC agent spawning handles this. Key: capture raw output, parse into structured form, handle parse failures gracefully. Promptfoo, DSPy, Evidently all have executor abstractions. |
| LLM-as-judge scoring | Comparing Haiku output to Opus ground truth. Deterministic string matching fails for semantic equivalence ("CMOs" = "marketing leadership"). Every serious prompt optimization system uses LLM judges. | Medium | Opus judges within the CC session. Rubric-based: define dimensions (accuracy, completeness, format compliance) with weights. Evidently uses accuracy scorer + LLM judge. Promptfoo has `llm-rubric` assertion type. |
| Iteration tracking | Knowing which prompt version scored what, when, and why. Without history, you can't tell if you're improving or going in circles. | Low | Git-native advantage. Each iteration = a commit or tracked file. Store: prompt text, scores per test case, aggregate score, mutation applied, timestamp. Braintrust and Promptfoo both version-control prompts. |
| Multi-input test sets | Testing a prompt against a single input is meaningless. You need N diverse inputs to catch failure modes. Every tool supports batch evaluation. | Low | Minimum 5-10 test inputs per scenario. Store as individual files or a single JSONL/YAML. Split into train/validation if doing feedback-driven mutation (Evidently uses 40/40/20 split). |
| Prompt mutation engine | The system needs to generate improved prompt candidates, not just re-roll randomly. This is the "optimization" in prompt optimization. | High | Failure-driven mutation: analyze what went wrong, generate targeted fixes. This is the core loop from APO (natural language gradients), OPRO (optimization trajectory in meta-prompt), Evidently (mistake examples in improvement prompt), and ETGPO (error taxonomy). |
| Pass/fail threshold | A clear "done" signal. Without a target score (92% per PROJECT.md), the loop runs forever or stops arbitrarily. | Low | Configurable per scenario. 92% is the project default. Also need max_iterations as a safety valve. |

## Differentiators

Features that set this system apart from DSPy/Promptfoo/Evidently. Not expected, but create real value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero-infra, CC-native execution | No API keys, no Python venv, no pip install, no external billing. Opus + Haiku available via agent spawning. This eliminates the #1 adoption barrier for prompt optimization. DSPy requires Python + API keys. Promptfoo requires Node + API keys. Evidently requires Python + API keys. We require: open a Claude Code session. | Low | The constraint IS the differentiator. File-based methodology means the "tool" is a set of conventions + a skill file, not a runtime. |
| Dynamic schema per scenario | Most tools hardcode output structure (classification labels, Q&A pairs). Our system lets the prompt itself define what fields to extract. ICP classification fields aren't static. | Medium | The scenario file defines expected output shape, but the prompt being optimized can propose its own field names/structure. Judge evaluates semantic alignment, not field-name matching. |
| Failure taxonomy generation | Beyond "wrong answer" -- categorize WHY outputs fail (missing fields, wrong granularity, corporate tone instead of casual, hallucinated data). ETGPO paper shows error taxonomy-guided optimization outperforms generic feedback. | Medium | After each iteration, cluster failures into categories. Feed the top 2-3 failure categories into the mutation prompt. This is more targeted than "here are your mistakes, do better." |
| Git-tracked prompt lineage | Every prompt version is a diffable file. You can `git log` the evolution, `git diff` between iterations, branch to try different mutation strategies. No other tool gives you this for free. | Low | Store prompts as files in a `iterations/` directory. Git handles versioning, diffing, branching. The prompt's evolution IS the git history. |
| Convergence detection with plateau analysis | Don't just stop at target score. Detect when scores plateau (no improvement for N iterations) and surface the specific failure patterns blocking further progress. STRIVE-style convergence checking. | Medium | Track score trajectory. If delta < min_score_gain for 3 consecutive iterations, halt and report: "Stuck at 87%. Remaining failures are all [category]. Manual prompt intervention needed for [specific pattern]." |
| Casual language normalization scoring | Specific to LeadGrow's use case but generalizable: judge not just accuracy but style. "Chief Marketing Officers" vs "CMOs" is a style failure even when semantically correct. The rubric encodes voice preferences. | Low | Add a "style" dimension to the judge rubric alongside accuracy and completeness. Weight it lower (0.15-0.2) but surface style violations in failure analysis. |
| Scenario portability | A scenario file is self-contained: inputs, ground truth, rubric, prompt history. Copy the folder to another project and it works. No database, no server state, no project config dependency. | Low | Each scenario = one directory with known file structure. The "tool" is the skill that knows how to orchestrate the files. Portability comes from the file format, not the runtime. |

## Anti-Features

Features to explicitly NOT build given the CC-only constraint.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Web UI / dashboard | CC-native means terminal-native. Building a dashboard adds a runtime dependency, a server process, and maintenance burden. Promptfoo and Braintrust already have great UIs -- we can't compete and shouldn't try. | Markdown summary files after each run. `iteration-report.md` with scores, failures, and the current best prompt. Readable in any editor. |
| External API integration | The entire value prop is zero external billing. Adding API key support fractures the mental model and creates a "which model am I paying for?" confusion. | All execution through CC agent spawning. Opus = current session. Haiku = spawned agent with model override. |
| Fine-tuning / weight optimization | DSPy's BetterTogether combines prompt + weight optimization. We can't fine-tune through CC. This is a fundamentally different capability. | Pure prompt optimization. If someone needs fine-tuning, they need DSPy or a training pipeline, not this tool. |
| Real-time production monitoring | Braintrust monitors prompts in production. We're optimizing prompts offline for later use in skills/agents. There's no "production" to monitor. | The output is a prompt file. It gets used in a skill. The skill's own evaluation (if any) handles production quality. |
| Multi-model comparison | Promptfoo compares across 50+ models. We optimize for ONE target model (Haiku). Comparing across models is a different workflow. | Single target model per scenario. If you want to optimize for Sonnet instead of Haiku, create a new scenario or change the target model config. |
| Automated CI/CD pipeline | Braintrust blocks merges when prompts fail thresholds. Our prompts aren't deployed through CI. They're files that get copy-pasted into skills. | Manual "run the optimization" workflow via CC skill. The human decides when to accept a prompt. |
| Few-shot example selection | DSPy's BootstrapFewShot automatically selects and optimizes few-shot examples. This is powerful but requires a training dataset and programmatic example management. Over-engineering for file-based approach. | If few-shot examples help, include them manually in the prompt. The mutation engine can suggest adding/removing examples, but automated selection is out of scope. |
| Prompt template variables / interpolation engine | Promptfoo has `{{variable}}` syntax with provider-level variable injection. Building a template engine is scope creep. | Raw prompt text with manual variable placement. The scenario file provides test inputs; the prompt references them directly. CC handles the actual interpolation at execution time. |

## Feature Dependencies

```
Scenario Definition ──> Ground Truth Generation ──> Candidate Prompt Execution
                                                          │
                                                          v
                                            LLM-as-Judge Scoring
                                                          │
                                                          v
                                              Iteration Tracking
                                                          │
                                                          v
                                          Prompt Mutation Engine ──> back to Execution
                                                          │
                                                          v
                                          Convergence Detection ──> DONE or STUCK
                                                          │
                                                          v
                                          Failure Taxonomy (if STUCK)
```

Ground truth must exist before scoring can happen.
Scoring must happen before mutation can analyze failures.
Iteration tracking must exist before convergence can be detected.
Multi-input test sets are consumed by execution, not dependent on other features.

## MVP Recommendation

**Phase 1 -- The Loop Works:**
1. Scenario definition files (table stakes, low complexity, unlocks everything)
2. Ground truth generation via Opus (table stakes, the core value prop)
3. Candidate prompt execution via Haiku agent (table stakes, the actual test)
4. LLM-as-judge scoring with basic rubric (table stakes, closes the loop)
5. Iteration tracking in markdown files (table stakes, low complexity)
6. Pass/fail threshold with max_iterations safety valve (table stakes, prevents infinite loops)

**Phase 2 -- The Loop is Smart:**
7. Multi-input test sets (table stakes, makes evaluation meaningful)
8. Prompt mutation engine with failure analysis (table stakes, the "auto" in auto-prompt)
9. Failure taxonomy generation (differentiator, makes mutations targeted)
10. Convergence detection with plateau analysis (differentiator, knows when to stop)

**Phase 3 -- The Loop is Polished:**
11. Dynamic schema per scenario (differentiator, handles complex extraction tasks)
12. Git-tracked prompt lineage with diffable iterations (differentiator, free via file convention)
13. Casual language normalization scoring (differentiator, LeadGrow-specific but generalizable)

**Defer indefinitely:**
- Web UI, external API support, fine-tuning, CI/CD integration, multi-model comparison, few-shot automation, template engine. These are anti-features given the constraint, not future features.

## Competitive Landscape Reference

| System | Strengths We Learn From | What We Skip |
|--------|------------------------|--------------|
| DSPy | Signature abstraction (input/output typing), MIPROv2 Bayesian optimization, modular optimizer swapping | Python runtime, API keys, weight optimization, complex optimizer zoo |
| Promptfoo | YAML config format, assertion types (llm-rubric, JSON schema, contains), CI/CD gates | Node runtime, 50+ provider support, web UI, template variables |
| Evidently | Feedback strategy (mistake-driven mutation), train/val/test splits, configurable convergence (target_score + min_score_gain + max_iterations) | Python runtime, API keys, dataset management overhead |
| Braintrust Loop | Natural language goal description, auto-generated test datasets, production monitoring | SaaS dependency, API keys, production monitoring scope |
| ETGPO (research) | Error taxonomy-guided optimization, prevalence-weighted error categories | Research paper, no usable tool |
| APO (research) | Natural language gradients (per-example failure feedback aggregated into prompt edits) | Research paper, requires gradient-like infrastructure |

## Sources

- [Evidently AI: How we built open-source automated prompt optimization](https://www.evidentlyai.com/blog/automated-prompt-optimization)
- [Cameron Wolfe: Automatic Prompt Optimization](https://cameronrwolfe.substack.com/p/automatic-prompt-optimization)
- [DSPy Optimization Overview](https://dspy.ai/learn/optimization/overview/)
- [DSPy Optimizers](https://dspy.ai/learn/optimization/optimizers/)
- [Promptfoo Assertions and Metrics](https://www.promptfoo.dev/docs/configuration/expected-outputs/)
- [Promptfoo LLM Rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/)
- [Braintrust: Best Prompt Engineering Tools 2026](https://www.braintrust.dev/articles/best-prompt-engineering-tools-2026)
- [ETGPO: Error Taxonomy-Guided Prompt Optimization](https://arxiv.org/html/2602.00997)
- [GAAPO: Genetic Algorithmic Applied to Prompt Optimization](https://arxiv.org/html/2504.07157v3)
- [Promptbreeder: Self-Referential Self-Improvement via Prompt Evolution](https://arxiv.org/pdf/2309.16797)
- [Autorubric: A Unified Framework for Rubric-Based LLM Evaluation](https://arxiv.org/html/2603.00077v1)
- [Systematic Survey of Automatic Prompt Optimization Techniques](https://arxiv.org/html/2502.16923v2)
- [Opik Automatic Prompt Optimization](https://www.comet.com/site/products/opik/features/automatic-prompt-optimization/)
