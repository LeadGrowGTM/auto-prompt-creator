# Phase 3: Mutation + Optimization Loop - Research

**Researched:** 2026-03-31
**Domain:** SIMBA-style prompt mutation, convergence control, token budget management
**Confidence:** HIGH

## Summary

Phase 3 builds the optimization engine that transforms v001 (64% baseline) into a graduated prompt candidate at 92%+ accuracy. All infrastructure exists from Phases 1-2: ground truth (9 inputs, 5 train / 4 validation), Haiku execution via stdin piping, Opus judging with 3-run median voting, and immutable prompt versioning. What Phase 3 adds is the intelligence layer: failure analysis, targeted mutation, and autonomous loop control.

The core loop is: execute prompt on all 9 inputs via Haiku, judge all outputs via Opus, analyze failures by pattern, generate one focused mutation targeting the highest-frequency failure, write the next prompt version, repeat. This is greedy hill-climbing with SIMBA-style self-reflection. No population, no branching, no randomness.

**Primary recommendation:** Build the loop as a CC-orchestrated methodology (Opus reads evals, analyzes failures, writes mutations) with reusable execution/judge scripts from Phase 2. Each iteration produces three artifacts (prompt file, eval file, mutations.log entry) plus a git commit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Opus performs per-input failure analysis -- reads each input where Haiku scored below threshold, compares field-by-field against ground truth, and names the specific failure
- D-02: After per-input analysis, Opus aggregates across inputs to identify repeating failure patterns and assigns named taxonomy labels (e.g., "strong-fit-bias", "formal-language-regression", "missing-field", "hallucinated-data")
- D-03: Failure analysis output is structured JSON: array of named patterns, each with frequency count, affected inputs, affected dimensions, and a concrete description of what went wrong
- D-04: Known baseline failure: Haiku defaults to "strong" icp_fit in 6+ of 9 inputs. Accuracy dimension scored 0.472 (worst). Primary target for first mutations.
- D-05: First iterations use additive mutations -- append targeted corrective rules. Preserves what's already working (completeness at 0.972).
- D-06: If score plateaus for 2+ consecutive iterations with additive-only, switch to consolidation/rewrite pass
- D-07: Subtractive mutations only when approaching the 800-token budget
- D-08: Each mutation is a single focused change targeting one failure pattern. No multi-target mutations.
- D-09: 800-token cap from scenario.json. Monitor prompt length each iteration.
- D-10: When prompt reaches 700+ tokens, trigger consolidation pass
- D-11: If prompt hits 800 tokens and still below threshold, halt with "token-budget-exhausted" status
- D-12: Anneal loop runs autonomously via orchestration (extending run-v001.mjs pattern). Loop: execute -> judge -> analyze -> mutate -> write -> repeat.
- D-13: Halt conditions: success >= 0.92, max 15 iterations, convergence < 0.02 delta for 3 consecutive, overfitting gap > 0.08, token budget exceeded after consolidation
- D-14: Train and validation scores tracked separately every iteration
- D-15: Semantic drift check every 3 iterations
- D-16: On any halt, report the best version (highest validation score) as graduation candidate
- D-17: The anneal loop is a CC skill/methodology, not a standalone script. Each iteration orchestrated by Opus, spawning Haiku agents for execution.
- D-18: Each iteration produces: prompts/vNNN.md, evals/vNNN-raw.json, evals/vNNN.json, mutations.log entry
- D-19: Each iteration git-committed atomically. Commit pattern: `opt(icp-classification): vNNN -- [mutation type] -- [score]`
- D-20: Full prompt lineage diffable via `git log --follow prompts/`

### Claude's Discretion
- Exact structure of the failure analysis prompt given to Opus
- How to format the mutation instruction that transforms vN into vN+1
- Whether to use run-v001.mjs as literal base or rewrite the execution pattern
- Calibration of "semantic drift" -- what constitutes meaningful drift vs normal prompt evolution

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MUT-01 | Failure-driven mutation -- analyze what went wrong, generate targeted prompt improvements (SIMBA-style) | SIMBA algorithm maps directly: Opus reads per-input failures, identifies patterns, generates targeted rules. v001 eval data shows clear failure patterns (strong-fit-bias in 6/9 inputs). |
| MUT-02 | Failure taxonomy -- categorize failures into named patterns | v001 eval rationales already contain pattern signals. Structured JSON output format defined in D-03. Taxonomy seeds from known failures: strong-fit-bias, formal-language-regression. |
| MUT-03 | Mutations include additive and subtractive | D-05/D-06/D-07 define the strategy: additive first, consolidation on plateau, subtractive near budget. v001 is ~205 words (~270 tokens), so ~530 tokens of headroom for additive before budget pressure. |
| MUT-04 | Token budget enforcement -- 800 tokens with consolidation passes | v001 baseline ~270 tokens. 800-token cap from scenario.json. Consolidation trigger at 700+ (D-10). Halt on exhaustion (D-11). |
| LOOP-01 | Anneal loop runs until accuracy >= 0.92 or max 15 iterations | Greedy hill-climbing with halt conditions. v001 at 0.64, needs +0.28. At ~0.05-0.07 per productive iteration, expect 5-8 iterations to reach threshold. |
| LOOP-02 | Convergence detection -- halt if delta < 0.02 for 3 consecutive | Track score history array. After each iteration, check last 3 deltas. Simple array comparison. |
| LOOP-03 | Train vs validation tracked separately, halt if gap > 0.08 | Infrastructure exists from Phase 2 (v001.json has train_score: 0.655, validation_score: 0.622). Current gap: 0.033 (healthy). |
| LOOP-04 | Semantic drift check every 3-5 iterations | Opus re-reads scenario.json task description, compares against current prompt intent. Flag-and-log, don't auto-halt (D-15). |
| TRACK-03 | All iterations git-committed for diffable lineage | Atomic commits per iteration. Pattern: `opt(icp-classification): vNNN -- [type] -- [score]`. Files: prompt + eval + raw + mutations.log. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Runtime:** Claude Code sessions only. No external API keys, no separate services.
- **Target model:** Haiku 4.5 via `claude --print --model haiku --allowedTools ""`
- **Shell:** Git Bash on Windows (`C:\Program Files\Git\usr\bin\bash.exe`). Stdin piping pattern established in run-v001.mjs.
- **No deletion:** Archive policy applies. Failed prompt versions are never deleted.
- **Bun runtime:** Use `bun` not `node` for script execution (workspace standard).
- **GSD workflow:** All work through GSD commands.

## Architecture Patterns

### Iteration Data Flow

```
For each iteration N:
  1. EXECUTE: Run prompts/vN.md on all 9 inputs via Haiku
     -> evals/vN-raw.json (raw Haiku outputs)

  2. JUDGE: Opus scores each output vs ground truth (3-run median)
     -> evals/vN.json (scored results with train/val split)

  3. ANALYZE: Opus reads vN.json, identifies failure patterns
     -> failure_analysis JSON (in-memory, fed to mutation step)

  4. CHECK HALT: Evaluate all halt conditions
     -> If halt triggered: report best version, stop
     -> If continuing: proceed to mutation

  5. MUTATE: Opus generates targeted prompt change
     -> prompts/v{N+1}.md (new prompt version)
     -> mutations.log append (what changed, why, score)

  6. COMMIT: git add + commit all iteration artifacts
     -> Atomic commit with structured message
```

### Recommended File Structure (Phase 3 additions)

```
scenarios/icp-classification/
  prompts/
    v001.md          (exists - baseline)
    v002.md          (Phase 3 creates)
    v003.md          ...
  evals/
    run-v001.mjs     (exists - execution script template)
    v001-raw.json    (exists - Haiku outputs)
    v001.json        (exists - judged scores)
    v002-raw.json    (Phase 3 creates)
    v002.json        ...
  mutations.log      (exists - v001 entry, Phase 3 appends)
```

### Pattern: Failure Analysis Structure

The failure analysis JSON that feeds the mutation engine:

```json
{
  "iteration": "v001",
  "overall_score": 0.6403,
  "train_score": 0.655,
  "validation_score": 0.6219,
  "patterns": [
    {
      "name": "strong-fit-bias",
      "frequency": 5,
      "severity": "critical",
      "affected_inputs": ["abacus-ai", "bartos-industries", "dealer-teamwork", "osp", "roush-cleantech"],
      "affected_dimensions": ["accuracy"],
      "description": "Haiku defaults to 'strong' icp_fit when ground truth says moderate or weak. 5 of 9 inputs have wrong icp_fit, and this field drives accuracy scoring.",
      "evidence": "abacus-ai: strong vs weak. bartos-industries: moderate vs strong. dealer-teamwork: moderate vs weak. osp: strong vs moderate. roush-cleantech: strong vs moderate.",
      "suggested_rule": "Add explicit decision criteria for icp_fit that forces Haiku to consider disqualifying factors before defaulting to strong."
    },
    {
      "name": "formal-language-regression",
      "frequency": 4,
      "affected_inputs": ["abacus-ai", "dbs-building-solutions", "roush-cleantech", "title-one"],
      "affected_dimensions": ["label_normalization"],
      "description": "Decision maker titles use formal style (VP of Sales, Operations Manager, Founder/CEO) instead of casual (sales leads, ops directors, the founder)."
    }
  ],
  "priority_target": "strong-fit-bias"
}
```

### Pattern: Mutation Log Entry Format

Extending the existing mutations.log format:

```
## v001 -> v002 (2026-03-31T19:00:00Z)
Target: strong-fit-bias (5/9 inputs affected)
Type: additive
Mutation: Added "ICP Fit Decision Rules" section with explicit criteria:
  - strong: matches industry + size + has addressable sales pain
  - moderate: matches 1-2 but has blocking factors (gov procurement, capacity constraints, wrong buyer persona)
  - weak: fundamental mismatch (too small, wrong market, no sales infrastructure need)
Token count: v001=270 -> v002=380 (+110)
Score delta: 0.6403 -> [measured after run]
Train: [measured] | Validation: [measured]
```

### Pattern: Loop State Tracking

Track loop state in a lightweight JSON file or in-memory during the CC session:

```json
{
  "scenario": "icp-classification",
  "current_iteration": 3,
  "best_version": "v002",
  "best_validation_score": 0.78,
  "score_history": [
    {"version": "v001", "overall": 0.6403, "train": 0.655, "val": 0.622, "tokens": 270},
    {"version": "v002", "overall": 0.82, "train": 0.84, "val": 0.79, "tokens": 380},
    {"version": "v003", "overall": 0.83, "train": 0.86, "val": 0.79, "tokens": 420}
  ],
  "consecutive_plateaus": 1,
  "last_mutation_type": "additive",
  "halt_reason": null
}
```

### Anti-Patterns to Avoid

- **Multi-target mutations:** Changing two things at once makes it impossible to tell what helped. D-08 is clear: one failure pattern per mutation.
- **Optimizing on training set only:** Always run on all 9 inputs (5 train + 4 validation). Train-only optimization is how overfitting happens.
- **Blind rewriting:** Never regenerate the entire prompt from scratch. Always start from the previous version and make a targeted change. The mutation log must explain what changed and why.
- **Ignoring regression:** After each mutation, check that ALL dimensions maintained or improved. If accuracy improves but completeness drops, the mutation introduced a regression.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom tokenizer | Approximate: words * 1.3 for English text | Exact Anthropic tokenization not available in CC. Word count * 1.3 is a conservative estimate. v001 is 205 words, which at 1.3x = ~267 tokens. Close enough for a 800-token budget. |
| Prompt execution | New execution script | Adapt run-v001.mjs pattern | Stdin piping, code fence stripping, error handling all proven in Phase 2 |
| Score computation | Manual calculation | Adapt compute-scores.py pattern | Rubric weights, normalization, train/val split logic all proven |
| Git operations | Complex git workflows | Simple `git add` + `git commit` per iteration | Atomic commits, structured messages. No branches needed. |

## Common Pitfalls

### Pitfall 1: Strong-Fit Bias Persistence
**What goes wrong:** The first mutation adds icp_fit rules, but Haiku still defaults to "strong" because the rules are too abstract. Haiku needs concrete examples, not just criteria definitions.
**Why it happens:** Haiku follows direct examples better than abstract rules (Pitfall 10 from PITFALLS.md). Opus writes prompts the way Opus thinks, not the way Haiku processes instructions.
**How to avoid:** Include 1-2 concrete examples in the icp_fit rules showing when a company that LOOKS strong is actually moderate or weak. Make the disqualifying factors explicit and visual.
**Warning signs:** v002 accuracy doesn't improve significantly on the icp_fit failures.

### Pitfall 2: Overfitting to Train Set
**What goes wrong:** Mutations that fix train failures make validation worse. The gap widens past 8%.
**Why it happens:** With only 5 train inputs, rules can become too specific to those exact companies. A rule like "government procurement = moderate fit" might be perfect for roush-cleantech (validation) but was derived from train patterns.
**How to avoid:** Always track train vs validation separately. Current gap is 0.033, so there's headroom. But watch it every iteration. The 0.08 halt threshold (D-13) is the hard stop.
**Warning signs:** Train accuracy climbing faster than validation. Any iteration where validation drops while train improves.

### Pitfall 3: Token Budget Burn Rate
**What goes wrong:** Each additive mutation adds 50-150 tokens. After 4-5 iterations of pure additive, the prompt hits 700+ tokens and needs consolidation before reaching the accuracy threshold.
**Why it happens:** v001 is ~270 tokens. Budget is 800. That's ~530 tokens of headroom, but each targeted rule with examples easily consumes 100+ tokens. Five additive iterations = 500+ tokens added.
**How to avoid:** Track token count every iteration. Trigger consolidation at 700 (D-10). Design mutations to be concise: rules, not essays. Avoid verbose examples.
**Warning signs:** Token count growing faster than accuracy. 700+ tokens before 0.85 accuracy.

### Pitfall 4: Convergence Trap at ~85%
**What goes wrong:** The "easy" failures (strong-fit-bias, formal language) get fixed in iterations 1-3, bringing score to ~85%. Remaining failures are harder (edge cases, ambiguous companies) and additive rules don't help.
**Why it happens:** The first mutations target the highest-frequency patterns. Once those are fixed, remaining failures are lower-frequency and harder to generalize from.
**How to avoid:** D-06 addresses this: if plateau for 2+ iterations, switch from additive to consolidation/rewrite. A rewrite can restructure the prompt's logic flow rather than just appending more rules. Also consider that 92% with 9 inputs means allowing at most 0.72 average per-input score across all inputs, which is achievable if the worst inputs score ~0.5 while the best score ~0.9.
**Warning signs:** Score oscillating between 0.83 and 0.87 for 3+ iterations.

### Pitfall 5: Semantic Drift in Late Iterations
**What goes wrong:** After 8+ iterations of accumulated rules, the prompt's behavior shifts away from the original task intent. It becomes a list of exception-handling rules rather than a coherent classification methodology.
**Why it happens:** Each mutation is locally rational but the cumulative effect transforms the prompt's character. Documented in PITFALLS.md Pitfall 3.
**How to avoid:** D-15's semantic drift check every 3 iterations. Opus re-reads scenario.json description and compares against the current prompt's effective behavior. Flag if the prompt has become a rules-patching exercise rather than a coherent classifier.
**Warning signs:** Prompt length growing monotonically. Late outputs looking "templated." Judge rationales mentioning rule conflicts.

## Code Examples

### Execution Script Adaptation (from run-v001.mjs)

The Phase 2 execution script is directly reusable. Key changes for iteration N:

```javascript
// Parameterize for any version
const VERSION = process.argv[2] || 'v001';  // e.g., 'v002'
const PROMPT_FILE = join(BASE, `prompts/${VERSION}.md`);
const OUT_FILE = join(BASE, `evals/${VERSION}-raw.json`);
```

The stdin piping pattern, code fence stripping, and error handling are proven and should be reused verbatim. The only change is parameterizing the version number.

### Token Estimation

```javascript
// Conservative token estimate for English text
function estimateTokens(text) {
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount * 1.3);
}

// Check budget
const promptText = readFileSync(`prompts/${version}.md`, 'utf8');
const tokens = estimateTokens(promptText);
if (tokens >= 700) console.log('CONSOLIDATION TRIGGER');
if (tokens >= 800) console.log('TOKEN BUDGET EXCEEDED');
```

### Halt Condition Check

```javascript
function checkHaltConditions(state) {
  const latest = state.score_history[state.score_history.length - 1];

  // Success
  if (latest.overall >= 0.92) return { halt: true, reason: 'threshold-reached', best: findBestValidation(state) };

  // Max iterations
  if (state.current_iteration >= 15) return { halt: true, reason: 'max-iterations', best: findBestValidation(state) };

  // Convergence plateau (3 consecutive deltas < 0.02)
  if (state.score_history.length >= 4) {
    const last3 = state.score_history.slice(-3);
    const prev = state.score_history[state.score_history.length - 4];
    const deltas = last3.map((s, i) => {
      const before = i === 0 ? prev : last3[i - 1];
      return Math.abs(s.overall - before.overall);
    });
    if (deltas.every(d => d < 0.02)) return { halt: true, reason: 'convergence-plateau', best: findBestValidation(state) };
  }

  // Overfitting
  if (Math.abs(latest.train - latest.val) > 0.08) return { halt: true, reason: 'overfitting', best: findBestValidation(state) };

  // Token budget (checked after consolidation attempt)
  if (latest.tokens > 800) return { halt: true, reason: 'token-budget-exhausted', best: findBestValidation(state) };

  return { halt: false };
}

function findBestValidation(state) {
  return state.score_history.reduce((best, s) => s.val > best.val ? s : best);
}
```

### Git Commit Pattern

```bash
# After each iteration
git add scenarios/icp-classification/prompts/vNNN.md \
        scenarios/icp-classification/evals/vNNN-raw.json \
        scenarios/icp-classification/evals/vNNN.json \
        scenarios/icp-classification/mutations.log

git commit -m "opt(icp-classification): vNNN -- additive -- 0.82"
```

## Baseline Failure Analysis (Pre-Research for Iteration 1)

The v001 eval data reveals clear patterns that the first iteration will target:

### Primary: Strong-Fit Bias (5/9 inputs affected, accuracy = 0.472)

| Input | Haiku icp_fit | Ground Truth | Error |
|-------|--------------|-------------|-------|
| abacus-ai | strong | weak | Opposite |
| bartos-industries | moderate | strong | Under-classified |
| dealer-teamwork | moderate | weak | Over-classified |
| osp | strong | moderate | Over-classified |
| roush-cleantech | strong | moderate | Over-classified |
| title-one | strong | weak | Opposite |

Haiku's distribution: 5 strong, 2 moderate, 2 correct (dbs, trx, wisconsin).
Ground truth distribution: 3 strong, 3 moderate, 3 weak.

The prompt's current icp_fit criteria are too vague: "strong = matches on industry + size + pain points for B2B service outbound." This gives Haiku no reason NOT to say strong for any B2B company.

**First mutation target:** Add explicit disqualifying criteria and decision tree for icp_fit.

### Secondary: Formal Language (4/9 inputs affected, label_normalization = 0.611)

Decision maker titles use formal patterns: "VP of Sales", "Operations Manager", "Business Development Manager", "Founder/CEO" vs ground truth casual: "sales leads", "ops directors", "biz dev", "the founder".

**Second mutation target (iteration 2):** Add DO/DON'T title examples.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Random prompt variations | SIMBA self-reflective rules | DSPy 2.6+ (2025) | 10-15 iterations instead of 40+ |
| Single holistic score | Multi-dimension weighted rubric | G-Eval / DSPy metrics (2024) | Targeted mutations possible |
| Manual prompt editing | Automated failure analysis + mutation | This project | Reproducible, diffable optimization |

## Open Questions

1. **Token estimation accuracy**
   - What we know: Word count * 1.3 is a rough approximation for English text
   - What's unclear: Exact Anthropic tokenization is not available in CC
   - Recommendation: Use the approximation. With 530 tokens of headroom, even 20% estimation error is tolerable. If the prompt approaches 700 estimated tokens, be conservative.

2. **Consolidation pass quality**
   - What we know: Opus can rewrite prompts to be more concise (D-06, D-10)
   - What's unclear: Whether consolidation preserves all accumulated rules or silently drops some
   - Recommendation: After consolidation, re-run eval before continuing. If score drops, revert to pre-consolidation and try a different consolidation approach.

3. **Semantic drift threshold**
   - What we know: D-15 says check every 3 iterations, flag-and-log
   - What's unclear: What quantitative signal indicates drift vs normal evolution
   - Recommendation: Opus reads scenario.json description + original v001 prompt, then reads current prompt, and answers: "Does this prompt still serve the same task? Rate 1-5." Below 3 = flag.

## Sources

### Primary (HIGH confidence)
- `scenarios/icp-classification/evals/v001.json` -- Baseline eval with per-input scores, failure rationales
- `scenarios/icp-classification/prompts/v001.md` -- Baseline prompt (~270 tokens)
- `scenarios/icp-classification/scenario.json` -- Config: threshold 0.92, max_iterations 15, token_budget 800
- `scenarios/icp-classification/evals/run-v001.mjs` -- Proven execution pattern (stdin piping, code fence stripping)
- `.planning/research/STACK.md` -- SIMBA algorithm, mutation strategy ranking
- `.planning/research/PITFALLS.md` -- 11 documented pitfalls with mitigations
- `.planning/research/ARCHITECTURE.md` -- System design, data flow, file formats

### Secondary (MEDIUM confidence)
- DSPy SIMBA documentation -- Algorithm details, self-reflective rule pattern
- Phase 2 CONTEXT.md -- Judge design decisions, scoring aggregation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All components are CC-native, no external dependencies. Patterns proven in Phase 2.
- Architecture: HIGH -- Data flow, file formats, and loop structure directly extend Phase 2 artifacts.
- Pitfalls: HIGH -- Well-documented in research PITFALLS.md + empirically observed in v001 baseline.

**Research date:** 2026-03-31
**Valid until:** Indefinite (project-specific, not dependent on external library versions)
