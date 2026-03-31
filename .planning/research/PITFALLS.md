# Domain Pitfalls

**Domain:** Prompt optimization system (LLM judge + iterative mutation loop)
**Researched:** 2026-03-30
**Confidence:** HIGH (well-documented failure modes across DSPy, APE, academic literature)

## Critical Pitfalls

Mistakes that cause the system to produce prompts that look good on paper but fail in production.

### Pitfall 1: Overfitting to Training Examples

**What goes wrong:** The optimized prompt memorizes patterns specific to the training set rather than learning generalizable instructions. The prompt achieves 95%+ on test examples but drops to 70% on new inputs. This is the single most documented failure mode in prompt optimization.

**Why it happens:** Prompt optimizers work with tiny datasets (5-20 examples typically). With so few examples, the mutation engine finds shortcuts. For instance, if all training company descriptions happen to be SaaS, the prompt bakes in SaaS-specific language that fails on manufacturing companies. DSPy research recommends the inverse of deep learning splits: 20% train, 80% validation, because prompt optimization overfits faster than neural networks.

**Consequences:** Ship a prompt that works on your test cases, deploy it, and it produces garbage on the first novel input. The 92% accuracy number becomes meaningless.

**Warning signs:**
- Accuracy climbs to near-perfect within 2-3 iterations (too fast = memorization)
- Prompt contains specific values or patterns from training examples rather than abstract instructions
- Performance gap between train and held-out validation exceeds 10%

**Prevention:**
- Hold out at least 30-40% of ground truth examples as a validation set the optimizer never sees
- Track train vs. validation accuracy separately; halt if gap exceeds 8%
- Include deliberately diverse examples in ground truth (different industries, sizes, edge cases)
- Implement early stopping: if validation accuracy plateaus for N iterations, stop

**Detection:** Compare train-set accuracy vs. held-out accuracy after every mutation round. Divergence = overfitting.

**Phase:** Must be addressed in Phase 1 (core loop design). The evaluation split strategy is foundational.

---

### Pitfall 2: Judge Unreliability (Noisy, Biased, Uncalibrated Scores)

**What goes wrong:** The LLM judge (Opus) gives inconsistent scores for the same output across runs, exhibits systematic biases (verbosity bias, position bias, agreeableness bias), and scores are not well-calibrated (a "0.8" doesn't mean the same thing across different rubric dimensions).

**Why it happens:** Research identifies 12+ bias types in LLM-as-judge systems. Key ones for this project:
- **Agreeableness bias:** Opus over-accepts (TPR >96%, TNR <25%), meaning it says "looks good" too often. This inflates scores and masks real failures.
- **Verbosity bias:** Longer, more detailed Haiku outputs score higher even when less accurate.
- **Run-to-run variance:** Even at temperature 0, LLMs exhibit scoring variance across runs due to stochastic sampling internals. A score of 0.85 might be 0.78 or 0.91 on re-run.
- **Format sensitivity:** Minor formatting changes (bullet points vs. paragraphs) can shift scores by 10-15%.

**Consequences:** The optimization loop chases noise instead of signal. A prompt mutation that genuinely improves quality gets rejected because the judge scored it lower by chance. A bad mutation gets accepted because the judge was generous. The optimizer converges on prompts that game the judge rather than produce genuinely good output.

**Warning signs:**
- Score oscillation: accuracy bouncing between 0.82 and 0.91 without clear trend
- Mutations that add verbosity or formatting consistently score higher
- Re-running the same prompt+input pair gives different scores

**Prevention:**
- **Multi-sample voting:** Run each evaluation 3 times, take the majority or median score. Reduces variance dramatically.
- **Binary or 3-point scale instead of continuous:** "Pass/Fail" or "Pass/Partial/Fail" is more reliable than 0-1 floating point scores. LLM judges are better at classification than regression.
- **Rubric anchoring:** Provide concrete examples of what a "pass" and "fail" look like in the judge prompt. Calibration examples are critical.
- **Dimension-level scoring:** Score each rubric dimension separately (field accuracy, format compliance, language style) rather than a single holistic score. Easier for the judge and more actionable for the mutation engine.

**Detection:** Run the same prompt on the same input 5 times. If score variance exceeds 0.1 (on a 0-1 scale), your judge is too noisy to drive optimization.

**Phase:** Must be addressed in Phase 1 (evaluation framework). Judge reliability is the foundation everything else rests on.

---

### Pitfall 3: Semantic Drift (Optimizes for Score, Loses Intent)

**What goes wrong:** The prompt evolves to maximize the judge score but drifts away from the original task intent. The output technically satisfies the rubric but stops being useful for the actual downstream purpose. For ICP classification, this might mean the prompt produces perfectly formatted output with all required fields but the classifications themselves become increasingly generic or templated.

**Why it happens:** The optimization loop has no mechanism to preserve semantic alignment with the original intent. Each mutation fixes a failure case, but the cumulative effect of 10+ mutations can transform the prompt's "personality" entirely. Research on DPO-based prompt optimization confirms that token-level regularization leaves semantic inconsistency unchecked: prompts that win higher scores can drift away from the user's intended meaning.

**Consequences:** You ship a prompt that scores 94% on the rubric but produces output that Mitch looks at and says "this isn't what I wanted." The rubric becomes a Goodhart's Law trap.

**Warning signs:**
- Late-stage mutations add increasingly specific/narrow instructions
- Output starts looking "templated" or formulaic
- Human spot-check reveals outputs that are technically correct but miss the point
- Prompt length growing monotonically (sign of accumulated patches)

**Prevention:**
- **Intent anchor:** Store the original task description and periodically (every 3-5 iterations) check that the prompt still serves it. This can be a separate judge call: "Does this prompt still accomplish [original intent]?"
- **Human-in-the-loop checkpoint:** After optimization converges, require a human review of 3-5 outputs before declaring the prompt "done." The 92% threshold is necessary but not sufficient.
- **Rubric quality over quantity:** Fewer, more meaningful rubric dimensions beat many granular ones. Each dimension should map to something the user actually cares about.

**Detection:** Compare early-iteration outputs vs. late-iteration outputs side by side. If they feel qualitatively different despite similar scores, drift has occurred.

**Phase:** Phase 2 (mutation engine). The mutation strategy must include drift detection, not just score improvement.

---

### Pitfall 4: Prompt Length Explosion

**What goes wrong:** Each mutation round adds instructions, caveats, edge case handling, and examples to the prompt. After 10+ iterations, the prompt is 2000+ tokens, unwieldy, and paradoxically performs worse because the target model (Haiku) gets confused by contradictory or redundant instructions.

**Why it happens:** The mutation engine's natural instinct is additive: "the output got field X wrong, so add an instruction about field X." It never removes or consolidates. Research confirms longer prompts do not necessarily yield better results, and may overfit and be less transferable.

**Consequences:** The prompt becomes unmaintainable. Haiku's limited context window and instruction-following capacity gets overwhelmed. New instructions contradict old ones. The prompt is no longer human-readable, defeating the purpose of version-controlled, diffable prompts.

**Warning signs:**
- Prompt token count increasing monotonically across iterations
- New instructions added without removing or consolidating old ones
- Haiku output quality plateaus or decreases despite "improvements"
- Prompt contains redundant or near-duplicate instructions

**Prevention:**
- **Token budget:** Set a max prompt length (e.g., 800 tokens for Haiku). Mutations that exceed the budget must consolidate or replace existing instructions.
- **Consolidation step:** Every N iterations, run a "compress" pass that rewrites the prompt to be more concise while preserving intent. This is itself an LLM call.
- **Subtractive mutations:** The mutation engine should explicitly try removing instructions and measuring impact. Many added instructions are neutral or harmful.
- **Track length vs. accuracy curve:** Plot it. If accuracy flatlines while length grows, the additions are noise.

**Detection:** Log prompt token count at each iteration. Alert if it exceeds 1.5x the starting length without proportional accuracy gains.

**Phase:** Phase 2 (mutation engine). Length constraints must be part of the mutation strategy from the start.

---

### Pitfall 5: Ground Truth Quality (Garbage In, Garbage Out)

**What goes wrong:** The Opus-generated ground truth contains errors, inconsistencies, or ambiguities. The optimizer then trains toward flawed targets, producing prompts that replicate Opus's mistakes rather than producing correct output.

**Why it happens:** Opus is powerful but not infallible. For ICP classification, Opus might:
- Inconsistently categorize the same company size as "mid-market" vs. "enterprise" across examples
- Use different label granularity for similar inputs
- Miss edge cases or make judgment calls that a human would disagree with
The system treats Opus output as authoritative ground truth, but it's actually "pretty good" ground truth.

**Consequences:** A ceiling effect: the optimized prompt can never be better than the ground truth. If ground truth is 90% correct, 92% accuracy against it means the prompt perfectly replicates 92% of outputs that are themselves only 90% correct. Net accuracy against reality: ~83%.

**Warning signs:**
- Inconsistencies within the ground truth set (same type of input, different labels)
- The optimizer converges quickly to 92%+ (might mean the rubric is too lenient, not that the prompt is good)
- Human review of ground truth reveals disagreements

**Prevention:**
- **Human review of ground truth:** Before optimization begins, review at least 20% of Opus-generated ground truth. Fix inconsistencies.
- **Consistency check:** Run Opus on similar inputs and verify label consistency. If "company with 150 employees" gets different labels in different examples, the ground truth has a calibration problem.
- **Inter-rater style check:** Generate ground truth twice for the same inputs. Differences reveal where Opus is uncertain, and those examples need human adjudication.
- **Label normalization:** Define canonical labels upfront. Don't let Opus freestyle labels that are "close enough" but different.

**Detection:** Run duplicate ground truth generation and measure agreement rate. Below 90% agreement = ground truth is too noisy to optimize against.

**Phase:** Phase 1 (ground truth generation). This is literally step one and must be done carefully.

---

## Moderate Pitfalls

### Pitfall 6: Convergence Traps (Local Optima)

**What goes wrong:** The optimizer finds a prompt that scores 85% and all local mutations (single instruction changes) make it worse. It's stuck at a local optimum, unable to reach the 92% target.

**Why it happens:** Greedy mutation strategies only accept improvements. If the path from 85% to 92% requires temporarily making the prompt worse (restructuring, removing a crutch instruction, changing the overall approach), the optimizer will never find it.

**Prevention:**
- **Temperature in mutation:** Occasionally accept slightly worse mutations (simulated annealing) to escape local optima
- **Restart strategy:** If no improvement after N iterations, try a fundamentally different prompt structure rather than more micro-mutations
- **Multiple starting points:** Run optimization from 2-3 different initial prompts in parallel, take the best
- **Macro vs. micro mutations:** Support both "tweak one instruction" and "rewrite the whole approach" mutation types

**Detection:** Accuracy plateau for 5+ iterations with no improvement despite diverse mutations attempted.

**Phase:** Phase 2 (mutation engine) and Phase 3 (anneal loop). The loop needs escape hatches.

---

### Pitfall 7: Evaluation Consistency Across Runs

**What goes wrong:** Running the exact same prompt on the exact same input produces different Haiku outputs and different judge scores across runs. This makes it impossible to tell if a mutation actually helped or if you're just seeing noise.

**Why it happens:** Even at temperature 0, LLMs have some variance (GPU non-determinism, batching effects). Haiku's variance is compounded by the judge's variance, creating double noise. Research confirms that even temperature=0 does not guarantee deterministic outputs.

**Prevention:**
- **Multi-run averaging:** Run each evaluation 3 times minimum, use median score
- **Low temperature for both Haiku and judge calls:** Minimize stochastic variance
- **Statistical significance:** Don't accept a mutation unless the improvement exceeds the noise floor (measured empirically)
- **Larger evaluation sets:** More examples reduce the impact of per-example variance

**Detection:** Run baseline prompt 5 times on same inputs. If score standard deviation exceeds 0.05, noise floor is too high for reliable optimization.

**Phase:** Phase 1 (evaluation framework). Must establish noise floor before optimization begins.

---

### Pitfall 8: Rubric Gaming Without Structural Diversity

**What goes wrong:** The prompt learns to produce output that satisfies the rubric's letter but not its spirit. For example, if the rubric checks "includes company size classification," the prompt might always output "mid-market" because that's the most common category and maximizes expected score.

**Why it happens:** The rubric is a proxy for quality. Any proxy can be gamed. If the rubric doesn't check for the full range of expected outputs, the optimizer will find the dominant class strategy.

**Prevention:**
- **Per-category accuracy tracking:** Don't just track overall accuracy. Track accuracy per output category (e.g., accuracy on "enterprise" inputs, accuracy on "SMB" inputs separately)
- **Confusion matrix logging:** Know which categories are being confused for which
- **Balanced evaluation set:** Ensure ground truth includes sufficient examples of each expected output category
- **Anti-pattern detection:** Flag if the prompt always (>80%) outputs the same value for any field

**Detection:** Check output distribution. If any field has <3 distinct values across all test examples, the prompt may be gaming.

**Phase:** Phase 1 (evaluation framework) and Phase 3 (iteration tracking).

---

## Minor Pitfalls

### Pitfall 9: Claude Code Session Context Limits

**What goes wrong:** Running the full optimization loop within a single Claude Code session exhausts the context window. Iteration history, prompt versions, evaluation results, and agent coordination data accumulate. The session degrades or loses critical context mid-optimization.

**Prevention:**
- Write all state to files, not session memory. Every iteration's prompt, scores, and mutations should be file-persisted.
- Design for session resumption: the loop should be able to restart from any saved state.
- Keep iteration logs lean: store diffs, not full prompt copies.

**Phase:** Phase 1 (core architecture). File-first state management is a design decision, not an afterthought.

---

### Pitfall 10: Haiku-Specific Instruction Following Quirks

**What goes wrong:** Prompts optimized by Opus (which writes them) use instruction patterns that Opus would follow perfectly but Haiku handles differently. Opus writes prompts the way it thinks, not the way Haiku thinks.

**Prevention:**
- Test every prompt mutation on Haiku, never on Opus
- Track which instruction patterns Haiku struggles with (complex conditionals, nested requirements, long lists) and add these as constraints for the mutation engine
- Keep instructions simple, direct, and short. Haiku is better at following 5 clear instructions than 15 nuanced ones.

**Phase:** Phase 2 (mutation engine). The engine needs a "Haiku compatibility" lens.

---

### Pitfall 11: Schema Rigidity vs. Dynamic Fields

**What goes wrong:** The system hardcodes expected output fields. When applied to a new scenario with different fields, everything breaks. Alternatively, the system is too flexible and the judge can't evaluate outputs because it doesn't know what fields to expect.

**Prevention:**
- Define schema as part of the scenario file, not the system code
- The judge rubric must be schema-aware: generated from the scenario's field definitions
- Test with at least 2 different scenarios during development to ensure the system isn't accidentally coupled to ICP-specific field names

**Phase:** Phase 1 (scenario format design). Dynamic schema is a stated requirement; enforce it early.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Ground truth generation | Inconsistent Opus labels (Pitfall 5) | Human review + consistency checks before optimization |
| Evaluation framework | Judge noise masking real signal (Pitfall 2, 7) | Multi-run voting, binary scoring, noise floor measurement |
| Mutation engine | Length explosion + semantic drift (Pitfalls 3, 4) | Token budget, consolidation passes, intent anchoring |
| Anneal loop | Local optima (Pitfall 6) | Simulated annealing, restart strategy, macro mutations |
| Session management | Context exhaustion (Pitfall 9) | File-first state, session resumption design |
| Cross-scenario generalization | Schema rigidity (Pitfall 11) | Test with 2+ scenarios, schema-from-scenario |
| Final validation | Overfitting undetected (Pitfall 1) | Held-out validation set, train/val accuracy tracking |

## Sources

- [DSPy Optimization Overview](https://dspy.ai/learn/optimization/overview/) - Train/val split recommendations, optimization costs
- [Survey on LLM-as-a-Judge](https://arxiv.org/abs/2411.15594) - Comprehensive bias taxonomy
- [Can You Trust LLM Judgments?](https://arxiv.org/abs/2412.12509) - Reliability and calibration analysis
- [Calibrating Scores of LLM-as-a-Judge](https://www.godaddy.com/resources/news/calibrating-scores-of-llm-as-a-judge) - Score calibration methods
- [Judge Reliability Harness](https://arxiv.org/html/2603.05399) - Stress testing LLM judges
- [Justice or Prejudice? Biases in LLM-as-a-Judge](https://openreview.net/forum?id=3GTtZFiajM) - 12 bias types, CALM framework
- [Sem-DPO: Mitigating Semantic Inconsistency](https://arxiv.org/abs/2507.20133) - Semantic drift in prompt optimization
- [Promptomatix: Automatic Prompt Optimization](https://arxiv.org/abs/2507.14241) - Automated prompt engineering framework
- [LLM Consistency in 2025](https://www.keywordsai.co/blog/llm_consistency_2025) - Temperature and reproducibility
- [LLM Stability Analysis](https://arxiv.org/html/2408.04667v1) - Variance in LLM outputs
- [Prompt Optimization Comprehensive Guide](https://orq.ai/blog/prompt-optimization) - Overfitting and length issues
- [LangChain: Exploring Prompt Optimization](https://blog.langchain.com/exploring-prompt-optimization/) - Dev-set performance gaps
