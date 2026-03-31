# Project Research Summary

**Project:** Auto Prompt Creator
**Domain:** Prompt optimization system (CC-native, file-based)
**Researched:** 2026-03-30
**Confidence:** HIGH

## Executive Summary

The auto-prompt-creator is a file-based prompt optimization system that runs entirely inside Claude Code sessions. The core insight from research: the proven academic approaches (DSPy's SIMBA, APE, ETGPO) all share a simple loop -- run prompt, score against ground truth, analyze failures, mutate prompt, repeat. The complex parts these frameworks solve (API orchestration, parallelism, caching) are already handled by CC's agent spawning. We extract the algorithmic patterns and implement them as structured files + a SKILL.md methodology. No Python, no API keys, no external dependencies.

The recommended approach is SIMBA-style self-reflective optimization: Opus generates ground truth and judges outputs, Haiku executes candidate prompts via agent spawning, and Opus analyzes failures to generate targeted mutations. This is a greedy hill-climbing strategy guided by failure taxonomy, not random search. The system converges in 5-15 iterations on 5-10 test cases, well within CC session constraints. File formats (JSON for structured data, markdown for prompts, append-only logs for mutations) give us git-tracked versioning, diffability, and session resumption for free.

The top risks are overfitting to small training sets, judge unreliability (Opus scoring noise/bias), and prompt length explosion from additive-only mutations. All three have well-documented mitigations: train/validation splits, multi-run voting with binary scoring, and token budgets with periodic consolidation passes. The architecture research confirms that the research-process-builder's anneal loop pattern maps directly to this problem. The entire system is a scenario directory, a methodology skill, and disciplined file conventions.

## Key Findings

### Recommended Stack

No external runtime or dependencies. Claude Code IS the runtime. Opus orchestrates (ground truth generation, judging, mutation), Haiku executes candidate prompts via agent spawning. All state lives in files.

**Core technologies:**
- **Claude Code session (Opus)**: Orchestrator, ground truth generator, judge, mutation engine -- the session itself is the "framework"
- **Haiku (via agent spawning)**: Target model for candidate prompt execution -- cheap, fast, the model we're optimizing for
- **JSON files**: Structured data (scenarios, ground truth, evaluations) -- parseable by both humans and LLMs
- **Markdown files**: Prompt versions and the SKILL.md methodology -- diffable, copy-pasteable, human-readable
- **Git**: Version control doubles as experiment tracking -- prompt lineage, rollback, branching for free

**Key decisions:**
- SIMBA self-reflective rules over evolutionary/population-based approaches (targeted vs. random, 10x fewer iterations)
- Ground truth comparison over open-ended LLM judging (strictly more reliable)
- Greedy hill-climbing over Bayesian optimization (converges fast enough with failure analysis guidance)
- YAML/JSON+markdown over databases (human-readable, git-native, zero infrastructure)

### Expected Features

**Must have (table stakes):**
- Scenario definition files (task description, input/output schema, rubric, config)
- Ground truth generation via Opus with human review checkpoint
- Candidate prompt execution via Haiku agent spawning
- LLM-as-judge scoring with multi-dimension rubric (not single holistic score)
- Iteration tracking with per-input scores and failure analysis
- Multi-input test sets (minimum 5-10 diverse inputs per scenario)
- Prompt mutation engine with failure-driven targeting
- Pass/fail threshold (default 92%) with max_iterations safety valve

**Should have (differentiators):**
- Zero-infra CC-native execution (the constraint IS the differentiator)
- Failure taxonomy generation (named patterns like "formal-language-regression")
- Convergence detection with plateau analysis
- Git-tracked prompt lineage with diffable iterations
- Dynamic schema per scenario (not hardcoded to ICP fields)

**Defer indefinitely (anti-features):**
- Web UI / dashboard
- External API integration
- Fine-tuning / weight optimization
- Multi-model comparison
- CI/CD pipeline integration
- Few-shot automation
- Template interpolation engine

### Architecture Approach

The system is structured files + a SKILL.md methodology document. There is no runtime, no scripts, no server. Each scenario is a self-contained directory with known file structure. The CC session follows the SKILL.md to orchestrate a 6-stage loop: Define, Ground Truth, Candidate Run, Judge, Mutate, Graduate. Prompts are immutable versioned files. Evaluations are structured JSON. Mutations are logged in an append-only changelog.

**Major components:**
1. **SKILL.md** -- The methodology. How to define scenarios, run the loop, judge, mutate. Interactive skill with human checkpoints.
2. **scenario.json** -- Scenario definition. Task description, input/output schema, rubric dimensions with weights, config (target model, accuracy threshold, max iterations).
3. **ground-truth/*.json** -- One file per test case. Input + Opus-generated expected output. Human-reviewed.
4. **prompts/v{NNN}.md** -- Immutable prompt versions. Pure text, no metadata. Diffable via git.
5. **evals/v{NNN}.json** -- Structured evaluation results. Per-input scores, per-dimension scores, failure patterns, aggregate accuracy.
6. **mutations.log** -- Append-only changelog. What changed, why, which failure pattern it targets, score delta.
7. **library/{name}.md** -- Graduated prompts that hit the accuracy threshold. The deliverable.

### Critical Pitfalls

1. **Overfitting to training examples** -- Hold out 30-40% of ground truth as validation set. Track train vs. validation accuracy separately. Halt if gap exceeds 8%. Include deliberately diverse examples. This is the single most documented failure mode.

2. **Judge unreliability (noisy/biased Opus scores)** -- Use multi-run voting (3 runs, median score). Prefer binary or 3-point scales over continuous scores. Anchor rubrics with concrete pass/fail examples. Measure noise floor before optimization begins.

3. **Semantic drift (optimizes for score, loses intent)** -- Store original task intent. Run periodic intent-alignment checks every 3-5 iterations. Require human review of outputs before declaring a prompt "done." The 92% threshold is necessary but not sufficient.

4. **Prompt length explosion** -- Set token budget (800 tokens for Haiku). Run consolidation passes every N iterations. Include subtractive mutations (try removing instructions). Track length vs. accuracy curve.

5. **Ground truth quality (garbage in, garbage out)** -- Human review of at least 20% of Opus ground truth before optimization begins. Run consistency checks (generate ground truth twice, measure agreement). Define canonical labels upfront.

## Implications for Roadmap

### Phase 1: Scenario Foundation + Ground Truth
**Rationale:** Everything depends on having well-defined scenarios and quality ground truth. Research unanimously shows that ground truth quality is the ceiling for optimization quality. This must be bulletproof before the loop runs.
**Delivers:** scenario.json format, ground-truth file format, interactive intake flow in SKILL.md, human review checkpoint for ground truth, train/validation split strategy.
**Addresses:** Scenario definition, ground truth generation, multi-input test sets (table stakes).
**Avoids:** Ground truth quality pitfall (Pitfall 5), overfitting setup (Pitfall 1 -- split strategy defined here), schema rigidity (Pitfall 11 -- dynamic schema from scenario.json).

### Phase 2: Execution + Evaluation Engine
**Rationale:** Cannot optimize without measuring. The evaluation framework must be reliable before the mutation engine can trust its signals. Judge reliability is the foundation everything else rests on.
**Delivers:** Haiku agent spawning for candidate execution, LLM-as-judge scoring with rubric, evals/v{NNN}.json format, noise floor measurement, failure pattern identification.
**Addresses:** Candidate prompt execution, LLM-as-judge scoring, iteration tracking (table stakes).
**Avoids:** Judge unreliability (Pitfall 2), evaluation consistency (Pitfall 7), rubric gaming (Pitfall 8).

### Phase 3: Mutation Engine + Optimization Loop
**Rationale:** With reliable measurement in place, the mutation engine can generate targeted improvements. This is where SIMBA-style self-reflection, failure taxonomy, and convergence detection come together.
**Delivers:** Failure-driven prompt mutation, mutations.log format, token budget enforcement, convergence detection, plateau analysis, the full anneal loop with human checkpoints.
**Addresses:** Prompt mutation engine (table stakes), failure taxonomy generation, convergence detection (differentiators).
**Avoids:** Semantic drift (Pitfall 3), prompt length explosion (Pitfall 4), convergence traps (Pitfall 6).

### Phase 4: Graduation + Library
**Rationale:** Once the loop produces prompts that hit the accuracy threshold, they need a clean graduation path and portable format for use in other skills/agents.
**Delivers:** Graduation criteria, library/ format, scenario archival, BEST.md convenience copy.
**Addresses:** Git-tracked prompt lineage, scenario portability (differentiators).
**Avoids:** No major pitfalls -- this phase is straightforward file operations.

### Phase Ordering Rationale

- **Strict dependency chain:** Ground truth must exist before evaluation can score against it. Evaluation must work before mutations can analyze failures. Mutations must produce optimized prompts before graduation makes sense. No phase can be reordered.
- **Risk-front-loaded:** The two highest-risk areas (ground truth quality and judge reliability) are addressed in Phases 1-2, before the optimization loop runs. Catching these problems early prevents wasted iterations.
- **Incremental validation:** Each phase produces a testable artifact. Phase 1 can be validated by reviewing ground truth quality. Phase 2 can be validated by measuring judge noise floor. Phase 3 can be validated by running the loop on a real scenario. Phase 4 is validated by using a graduated prompt in production.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Judge calibration is the trickiest part. Multi-run voting, scoring scales, and rubric anchoring patterns need empirical validation on real scenarios. The literature documents 12+ bias types; which ones actually manifest with Opus-as-judge needs testing.
- **Phase 3:** Mutation strategy (when to add rules vs. rewrite vs. subtract) and convergence detection thresholds (how many plateau iterations before restart?) need empirical tuning. Academic papers give ranges, not exact values.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Scenario definition and ground truth generation follow well-established patterns from research-process-builder and DSPy. File formats are straightforward.
- **Phase 4:** Graduation is simple file operations. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero-dependency CC-native approach is well-validated. SIMBA, DSPy, and academic sources all confirm the core loop pattern. |
| Features | HIGH | Feature set derived from 6+ production tools (DSPy, Promptfoo, Evidently, Braintrust, ETGPO, APO). Table stakes are clear. |
| Architecture | HIGH | Architecture adapted from proven research-process-builder anneal loop. File formats are battle-tested patterns. |
| Pitfalls | HIGH | Pitfalls sourced from academic literature with documented failure modes and mitigations. Well-researched domain. |

**Overall confidence:** HIGH

### Gaps to Address

- **Haiku agent spawning mechanics:** Exactly how to pass a prompt file as system prompt to a spawned Haiku agent needs empirical validation in a CC session. The capability exists but the exact invocation pattern for structured output collection needs testing in Phase 2.
- **Judge noise floor with Opus:** Academic literature documents LLM judge variance, but Opus-specific variance on rubric-based scoring hasn't been measured. Phase 2 should begin with a noise floor test (same prompt, same input, 5 runs) before optimization begins.
- **Optimal train/validation split for tiny datasets:** DSPy recommends 20/80. Evidently uses 40/40/20 (train/val/test). With only 5-10 examples, even a 50/50 split means training on 3-5 examples. The right split for CC-constrained optimization needs empirical testing.
- **Token budget threshold for Haiku:** 800 tokens suggested as prompt length limit, but the actual sweet spot for Haiku instruction-following depends on prompt complexity. Needs testing with real scenarios.
- **Consolidation pass effectiveness:** Periodically rewriting the prompt to be more concise is recommended by multiple sources, but whether Opus can reliably compress a prompt without losing critical instructions needs validation.

## Sources

### Primary (HIGH confidence)
- [DSPy SIMBA Documentation](https://dspy.ai/api/optimizers/SIMBA/) -- core mutation strategy
- [DSPy Optimizers Overview](https://dspy.ai/learn/optimization/optimizers/) -- optimization landscape
- [TextGrad (Nature)](https://arxiv.org/abs/2406.07496) -- gradient-based alternative (rejected for our use case)
- [EvoPrompt (ICLR 2024)](https://arxiv.org/abs/2309.08532) -- evolutionary alternative (rejected)
- [ADAS (ICLR 2025)](https://arxiv.org/abs/2408.08435) -- meta-agent search (rejected)
- [Systematic Survey of Automatic Prompt Optimization (EMNLP 2025)](https://aclanthology.org/2025.emnlp-main.1681.pdf) -- comprehensive landscape
- [Survey on LLM-as-a-Judge](https://arxiv.org/abs/2411.15594) -- bias taxonomy
- [Can You Trust LLM Judgments?](https://arxiv.org/abs/2412.12509) -- reliability analysis
- research-process-builder (local repo) -- proven anneal loop architecture

### Secondary (MEDIUM confidence)
- [Evidently AI: Automated Prompt Optimization](https://www.evidentlyai.com/blog/automated-prompt-optimization) -- feedback strategy, convergence config
- [Cameron Wolfe: Automatic Prompt Optimization](https://cameronrwolfe.substack.com/p/automatic-prompt-optimization) -- mutation taxonomy
- [Promptfoo LLM Rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/) -- rubric patterns
- [DSPy SIMBA Explained](https://blog.mariusvach.com/posts/dspy-simba) -- SIMBA walkthrough
- [ETGPO: Error Taxonomy-Guided Prompt Optimization](https://arxiv.org/html/2602.00997) -- failure taxonomy approach

### Tertiary (LOW confidence)
- [LLM Consistency in 2025](https://www.keywordsai.co/blog/llm_consistency_2025) -- temperature/reproducibility (blog post)
- [Braintrust: Best Prompt Engineering Tools 2026](https://www.braintrust.dev/articles/best-prompt-engineering-tools-2026) -- commercial landscape (marketing content)

---
*Research completed: 2026-03-30*
*Ready for roadmap: yes*
