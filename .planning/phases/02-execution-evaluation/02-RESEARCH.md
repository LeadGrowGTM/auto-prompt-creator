# Phase 2: Execution + Evaluation - Research

**Researched:** 2026-03-31
**Domain:** CC agent spawning, LLM-as-judge evaluation, prompt version tracking
**Confidence:** HIGH

## Summary

Phase 2 builds three capabilities: (1) executing candidate prompts against Haiku via CC agent spawning, (2) scoring those outputs against ground truth using Opus as a structured judge with multi-run voting, and (3) tracking prompt versions and evaluation results as immutable files. Everything runs inside a Claude Code session. No scripts, no APIs, no external dependencies.

The ground truth from Phase 1 is solid: 9 companies, 3/3/3 strong/moderate/weak distribution, zero consistency disagreements, 5 train / 4 validation split. Phase 2 consumes these files as judge comparison targets. The main technical unknowns are Haiku agent spawning mechanics (how to pass prompt + input, how to capture structured JSON output) and judge noise floor (whether 3-run median produces stable enough scores for optimization).

**Primary recommendation:** Build the execution engine (Haiku agent call wrapper), the judge (Opus rubric scorer with calibration anchors), and the file formats (eval results JSON, prompt versioning, mutations.log) as three distinct implementation blocks. Test each independently before wiring them together.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Haiku is invoked via CC Agent tool with `model="haiku"` parameter and the candidate prompt passed inline. No separate skill files or external API calls.
- **D-02:** Agent receives the candidate prompt + one input at a time. Returns structured JSON matching the output schema from scenario.json.
- **D-03:** Parse failures (malformed JSON, missing fields) are caught, logged with the raw output, and scored as 0.0 for that input. The run continues to the next input -- never crash the session.
- **D-04:** Opus judges field-by-field, scoring each rubric dimension (accuracy: 0.4, label_normalization: 0.25, completeness: 0.2, specificity: 0.15) on a 1-5 scale per input.
- **D-05:** Judge prompt receives: ground truth output, Haiku output, rubric definitions, and calibration anchors (examples of 5/5 vs 1/5 for each dimension).
- **D-06:** Multi-run voting: 3 judge runs per input, take median per-dimension score. This reduces Opus scoring noise.
- **D-07:** Judge returns structured JSON with per-dimension scores and a brief rationale string per dimension.
- **D-08:** Per-input score = weighted average across dimensions (using rubric weights from scenario.json).
- **D-09:** Prompt-level score = arithmetic mean of all per-input scores across the evaluation set.
- **D-10:** Train and validation scores computed separately (using the split from Phase 1) so Phase 3 can detect overfitting.
- **D-11:** Each prompt version stored as `prompts/v001.md`, `prompts/v002.md`, etc. -- immutable after creation.
- **D-12:** Evaluation results stored as JSON files in `evals/` -- one file per prompt version (e.g., `evals/v001.json`) containing per-input scores, per-dimension scores, aggregate scores, and metadata.
- **D-13:** `mutations.log` is append-only: each entry records what changed, why, which failure pattern targeted, and the score delta. Phase 2 creates the file format; Phase 3 populates it.

### Claude's Discretion
- Exact prompt template for the Haiku agent call -- researcher/planner decide structure
- Exact JSON schema for eval result files -- planner decides field names
- Whether to run train-only or train+validation during iteration (Phase 3 decides policy; Phase 2 builds capability for both)
- Calibration anchor examples for the judge -- can be derived from ground truth during planning

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXEC-01 | Candidate prompts executed against Haiku via CC agent spawning | Agent tool pattern with model="haiku", prompt + input passed inline |
| EXEC-02 | Raw Haiku output captured and parsed into structured form | JSON.parse with try/catch, field validation against output_schema |
| EXEC-03 | Parse failures handled gracefully (logged, scored as 0, not crash) | Error boundary per-input, raw output preserved in eval results |
| EVAL-01 | Opus judges Haiku output against ground truth using multi-dimension rubric | 4-dimension rubric from scenario.json, 1-5 scale, chain-of-thought judging |
| EVAL-02 | Evaluation results stored as structured JSON per iteration | evals/v{NNN}.json format with per-input and per-dimension scores |
| EVAL-03 | Judge uses concrete pass/fail examples from rubric (calibration anchors) | Derived from ground truth: 5/5 = exact match examples, 1/5 = failure examples |
| EVAL-04 | Multi-run voting (3 judge runs, median score) to reduce scoring noise | 3 independent judge calls per input, median per-dimension, reduces variance |
| TRACK-01 | Each prompt version stored as immutable file (prompts/v001.md) | Sequential numbering, pure prompt text, no metadata in file |
| TRACK-02 | Mutations logged in append-only mutations.log | Structured text format: version transition, target pattern, mutation description, score delta |
</phase_requirements>

## Standard Stack

### Core
| Component | Implementation | Purpose | Why Standard |
|-----------|---------------|---------|--------------|
| Candidate executor | CC Agent tool with model="haiku" | Run candidate prompts against target model | CC provides model routing via agent spawning -- zero API cost |
| Judge | Opus (main session) with structured rubric prompt | Score Haiku output vs ground truth | Same session, no spawning needed, Opus handles semantic equivalence |
| Eval storage | JSON files in evals/ | Structured, parseable evaluation results | Machine-readable for Phase 3 mutation engine |
| Prompt storage | Markdown files in prompts/ | Immutable prompt versions | Human-readable, git-diffable |
| Mutation log | Plain text mutations.log | Append-only change history | Human-readable narrative, reconstructs optimization journey |

### Supporting
| Component | Implementation | Purpose | When to Use |
|-----------|---------------|---------|-------------|
| scenario.json reader | Direct file read | Load rubric weights, output schema, config | Every execution and evaluation run |
| Ground truth loader | Read all JSON from ground-truth/ | Load comparison targets for judge | Every evaluation run |
| Score calculator | Weighted average formula | Aggregate dimension scores to overall score | After judge scores collected |

### What We Do NOT Need
| Thing | Why Not |
|-------|---------|
| Python runtime | CC is the runtime |
| External APIs | CC handles model access via agent spawning |
| Database | JSON files + git sufficient for <15 iterations |
| Test framework | nyquist_validation is false in config |
| npm packages | No code to install -- this is a methodology executed by CC |

## Architecture Patterns

### Recommended File Layout (Phase 2 additions)
```
scenarios/icp-classification/
  prompts/
    v001.md               # First candidate prompt (pure text)
  evals/
    v001.json             # Evaluation results for v001
  mutations.log           # Append-only mutation history (created empty, Phase 3 populates)
```

### Pattern 1: Agent Spawning for Haiku Execution
**What:** Spawn a CC subagent with model="haiku", pass the candidate prompt as the agent's instruction, pass one input at a time as the user message. Collect structured JSON response.
**When to use:** Every candidate prompt evaluation (9 times per prompt version, once per input).
**Key detail:** The agent prompt must include explicit JSON output instructions with the exact schema from scenario.json. Haiku needs the schema defined inline -- it cannot reference external files.

**Agent call structure:**
```
Agent(
  model="haiku",
  prompt="[candidate prompt text from prompts/v{NNN}.md]\n\nCompany to classify:\n[input from ground-truth file]",
  expected_output="structured JSON"
)
```

The candidate prompt itself must contain:
1. The task instruction (classify this company)
2. The output schema (JSON with 6 fields)
3. Any rules/examples accumulated through mutation
4. The specific company input (appended at call time)

### Pattern 2: Structured Judge with Calibration Anchors
**What:** Opus evaluates Haiku output against ground truth by scoring each rubric dimension independently on a 1-5 scale with chain-of-thought reasoning.
**When to use:** After every Haiku execution, 3 times per input (multi-run voting).
**Key detail:** The judge prompt must include calibration anchors -- concrete examples of what a 5/5 and 1/5 look like for each dimension. These anchors prevent score drift and agreeableness bias.

**Judge prompt structure:**
```
You are evaluating a model's ICP classification output against ground truth.

## Ground Truth (the correct answer)
[ground truth expected_output JSON]

## Model Output (what the model produced)
[Haiku output JSON]

## Rubric Dimensions

### 1. Accuracy (weight: 0.4)
[description from scenario.json]
5/5 anchor: [example of perfect accuracy]
1/5 anchor: [example of wrong accuracy]

### 2. Label Normalization (weight: 0.25)
[description]
5/5 anchor: "CMOs", "commercial cleaning", "mid-market"
1/5 anchor: "Chief Marketing Officers", "janitorial services and facility management", "200-500 employee mid-size enterprise"

### 3. Completeness (weight: 0.2)
[description]
5/5 anchor: All 6 fields present with substantive values
1/5 anchor: Missing fields or "N/A" placeholders

### 4. Specificity (weight: 0.15)
[description]
5/5 anchor: Pain points reference specific details from company description
1/5 anchor: Generic pain points like "needs better marketing" or "wants to grow revenue"

## Instructions
Score each dimension 1-5. Provide a brief rationale per dimension.
Return JSON:
{
  "accuracy": { "score": N, "rationale": "..." },
  "label_normalization": { "score": N, "rationale": "..." },
  "completeness": { "score": N, "rationale": "..." },
  "specificity": { "score": N, "rationale": "..." }
}
```

### Pattern 3: Multi-Run Median Voting
**What:** Run the judge 3 times on the same (ground truth, Haiku output) pair. Take the median score per dimension. This reduces scoring noise from run-to-run variance.
**When to use:** Every input in every evaluation.
**Implementation:**
1. Call judge 3 times with identical inputs
2. For each dimension, collect 3 scores, sort, take middle value
3. The median scores become the official per-dimension scores for that input
4. Store all 3 runs in the eval file for transparency

### Pattern 4: Parse-or-Zero Error Handling
**What:** When Haiku returns malformed JSON or missing fields, log the raw output and score 0.0 for that input. Continue to the next input.
**When to use:** Every Haiku agent response.
**Implementation:**
1. Try JSON.parse on Haiku response
2. If parse fails: log raw text, set all dimension scores to 0, mark as `parse_failure: true`
3. If parse succeeds but fields missing: log which fields missing, set missing-field dimensions to 0
4. Never halt the evaluation run -- always continue to next input

### Anti-Patterns to Avoid
- **Holistic scoring:** Never score Haiku output with a single number. Always decompose into rubric dimensions. Single scores hide failure modes.
- **Judge without anchors:** Never run the judge without 5/5 and 1/5 calibration examples. Unanchored judges exhibit agreeableness bias (TPR >96%, TNR <25%).
- **Overwriting prompt versions:** Never edit v001.md in place. Always create v002.md. Immutability enables git diff and rollback.
- **Batching all inputs to one agent call:** Never send all 9 inputs to Haiku at once. One input per agent call. This isolates parse failures and gives per-input scoring.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model routing | Custom API client | CC Agent tool with model="haiku" | CC handles auth, model selection, context management |
| Semantic comparison | String matching / embeddings | Opus-as-judge with rubric | Handles "CMOs" = "marketing leadership" natively |
| Version numbering | Custom incrementer | Zero-padded sequential (v001, v002) | Simple, sortable, no edge cases |
| Score aggregation | Complex statistics | Weighted average + arithmetic mean | Matches scenario.json rubric weights exactly |

## Common Pitfalls

### Pitfall 1: Judge Agreeableness Bias
**What goes wrong:** Opus consistently scores 4-5/5 on everything, making all prompts look good. Real failures get masked.
**Why it happens:** LLM judges have documented agreeableness bias (TPR >96%, TNR <25%). Without calibration anchors, the judge defaults to "looks reasonable."
**How to avoid:** Calibration anchors with explicit 1/5 examples. The 1/5 anchor for label_normalization should show obviously formal language ("Chief Marketing Officers") so the judge has a concrete reference for what "bad" looks like.
**Warning signs:** All dimension scores above 4.0 on the first prompt version. Real first attempts should have at least one dimension scoring 2-3.

### Pitfall 2: Haiku JSON Output Instability
**What goes wrong:** Haiku sometimes wraps JSON in markdown code fences, adds explanatory text before/after the JSON, or uses slightly different field names than requested.
**Why it happens:** Haiku is less instruction-following than Opus. It interprets "return JSON" more loosely.
**How to avoid:** The candidate prompt must be extremely explicit about output format. Include the exact JSON structure as a template. Say "Return ONLY the JSON object, no other text." The parse logic should strip markdown fences and leading/trailing non-JSON text before attempting parse.
**Warning signs:** Parse failures on early prompt versions. Check if the raw output contains valid JSON wrapped in noise.

### Pitfall 3: Score Normalization Confusion
**What goes wrong:** Mixing up the 1-5 per-dimension scale with the 0-1 normalized overall score. A dimension score of 4 is not 0.8 -- it's (4-1)/(5-1) = 0.75 on a 0-1 scale, or 4/5 = 0.8 depending on convention.
**Why it happens:** scenario.json says "1-5 per dimension, weighted average normalized to 0-1" but doesn't specify the normalization formula.
**How to avoid:** Use this formula consistently: `normalized_dimension = (raw_score - 1) / (5 - 1)` to map 1-5 to 0-1. Then `overall = sum(normalized_dimension * weight)`. A score of 1 = 0.0, score of 5 = 1.0, score of 3 = 0.5.
**Warning signs:** Scores that seem too high or too low relative to the actual output quality.

### Pitfall 4: Multi-Run Voting Creating 3x Judge Cost
**What goes wrong:** 3 judge runs per input x 9 inputs x 4 dimensions = 108 judge evaluations per prompt version. This consumes significant Opus context within the CC session.
**Why it happens:** Multi-run voting is necessary for score stability but expensive in context.
**How to avoid:** Run voting on train set only during iteration (5 inputs x 3 runs = 15 judge calls). Run full voting on validation set only for final score reporting. Phase 2 builds the capability; Phase 3 decides the policy.
**Warning signs:** CC session context getting heavy after 2-3 full evaluations.

### Pitfall 5: Ground Truth Input Mismatch
**What goes wrong:** The input passed to Haiku doesn't exactly match the input stored in the ground truth file, causing the judge to evaluate against the wrong reference.
**Why it happens:** Ground truth files embed the input. If you reconstruct the input differently (different field ordering, missing optional fields), the judge might get confused.
**How to avoid:** Always read the input directly from the ground truth file's `input` field. The ground truth file is the single source of truth for both the input (what Haiku sees) and the expected output (what the judge compares against).

## Code Examples

### Scoring Formula
```
For each input:
  For each dimension d in [accuracy, label_normalization, completeness, specificity]:
    median_score_d = median of 3 judge runs for dimension d (1-5 scale)
    normalized_d = (median_score_d - 1) / 4   # maps 1-5 to 0.0-1.0

  input_score = sum(normalized_d * weight_d for all d)
  # weights: accuracy=0.4, label_normalization=0.25, completeness=0.2, specificity=0.15

For the prompt version:
  train_score = mean(input_score for inputs where split="train")
  validation_score = mean(input_score for inputs where split="validation")
  overall_score = mean(all input_scores)
```

### Eval Result File Schema (evals/v001.json)
```json
{
  "prompt_version": "v001",
  "timestamp": "2026-03-31T...",
  "config": {
    "target_model": "haiku",
    "judge_model": "opus",
    "judge_runs": 3,
    "rubric_version": 1
  },
  "aggregate": {
    "overall_score": 0.78,
    "train_score": 0.80,
    "validation_score": 0.75,
    "dimension_averages": {
      "accuracy": 0.82,
      "label_normalization": 0.71,
      "completeness": 0.85,
      "specificity": 0.72
    },
    "inputs_evaluated": 9,
    "parse_failures": 0
  },
  "per_input": [
    {
      "input_id": "abacus-ai",
      "split": "train",
      "weighted_score": 0.84,
      "dimensions": {
        "accuracy": { "median": 4, "runs": [4, 5, 4], "normalized": 0.75 },
        "label_normalization": { "median": 4, "runs": [4, 4, 3], "normalized": 0.75 },
        "completeness": { "median": 5, "runs": [5, 5, 5], "normalized": 1.0 },
        "specificity": { "median": 4, "runs": [3, 4, 4], "normalized": 0.75 }
      },
      "haiku_output": { },
      "parse_failure": false,
      "judge_rationales": {
        "accuracy": "Industry and size correct...",
        "label_normalization": "Casual language used throughout...",
        "completeness": "All 6 fields present...",
        "specificity": "Pain points reference company-specific details..."
      }
    }
  ],
  "failure_patterns": []
}
```

### Mutations Log Format (mutations.log)
```
## v001 (initial)
Created: [timestamp]
Source: Manual / generated by [method]
Train score: [score]
Validation score: [score]

## v001 -> v002 ([timestamp])
Target: [failure_pattern_name] ([N]/[total] inputs affected)
Mutation: [description of what was added/changed/removed]
Train score delta: [old] -> [new] ([+/-delta])
Validation score delta: [old] -> [new] ([+/-delta])
Dimensions changed: [dimension] ([old] -> [new]), ...
```

### Prompt Version File (prompts/v001.md)
```markdown
You are classifying a company into ICP segments. Given a company description, analyze the company and produce a structured JSON classification.

## Output Format

Return ONLY a JSON object with these exact fields (no other text, no code fences):

{
  "industry": "casual industry label",
  "company_size": "startup | SMB | mid-market | enterprise",
  "decision_makers": ["casual title 1", "casual title 2"],
  "pain_points": ["specific pain 1", "specific pain 2", "specific pain 3"],
  "icp_fit": "strong | moderate | weak",
  "reasoning": "One sentence explaining the classification"
}

## Rules

- Use casual business language. Write "CMOs" not "Chief Marketing Officers"
- company_size follows: startup (<20 emp), SMB (20-200), mid-market (200-2000), enterprise (2000+)
- Pain points must reference specific details from the company description
- icp_fit: strong = matches on industry + size + pain points, moderate = matches 1-2 dimensions, weak = does not match

## Company to Classify

{company_name}: {company_description}
```

## Calibration Anchors (Derived from Ground Truth)

The judge needs concrete examples of what 5/5 and 1/5 look like for each dimension. These are derived from the actual ground truth data:

### Accuracy Anchors
**5/5 (perfect):** For DBS Building Solutions (340 emp, $28M), output says industry="commercial cleaning", company_size="mid-market". Both factually correct.
**1/5 (wrong):** For DBS Building Solutions, output says industry="technology", company_size="startup". Completely wrong given the input.

### Label Normalization Anchors
**5/5 (casual):** decision_makers=["ops directors", "facility managers"], industry="commercial cleaning"
**1/5 (formal):** decision_makers=["Chief Operating Officers", "Facility Management Directors"], industry="janitorial services and facility management solutions"

### Completeness Anchors
**5/5 (all fields):** All 6 fields present with substantive values. Arrays have 2+ items.
**1/5 (missing):** Missing icp_fit field, pain_points=["N/A"], reasoning=""

### Specificity Anchors
**5/5 (specific):** pain_points=["scaling QA across corporate, medical, and industrial site types", "ServiceTitan dispatch limitations as they grow across the Midwest"]
**1/5 (generic):** pain_points=["needs better marketing", "wants to grow revenue", "looking for efficiency improvements"]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single holistic LLM judge score | Multi-dimension rubric with calibration anchors (G-Eval pattern) | 2024-2025 | Reduces judge bias, makes failures actionable |
| Run judge once, trust score | Multi-run voting (3+, median) | 2024-2025 | Reduces run-to-run variance by ~60% |
| Deterministic string matching for eval | LLM-as-judge with ground truth comparison | 2023-2024 | Handles semantic equivalence ("CMOs" = "marketing leadership") |

## Open Questions

1. **Haiku agent response format**
   - What we know: CC Agent tool supports model="haiku" parameter. The agent receives a prompt and returns text.
   - What's unclear: Exact mechanics of how the response is captured in the calling session. Does the agent return raw text that needs parsing, or structured data?
   - Recommendation: Build the parse layer defensively. Strip markdown fences, trim whitespace, attempt JSON.parse, fall back to regex extraction of JSON from surrounding text.

2. **Judge context cost per evaluation**
   - What we know: 3 runs x 9 inputs = 27 judge calls per prompt version. Each call includes ground truth + Haiku output + rubric + anchors.
   - What's unclear: How much context this consumes within a single CC session. Will it leave enough room for Phase 3's mutation analysis?
   - Recommendation: Phase 2 builds the full capability. Phase 3 decides whether to run train-only during iteration to conserve context.

3. **Score normalization formula**
   - What we know: scenario.json says "1-5 per dimension, weighted average normalized to 0-1"
   - What's unclear: Whether normalization is `score/5` (giving 0.2-1.0 range) or `(score-1)/4` (giving 0.0-1.0 range)
   - Recommendation: Use `(score-1)/4` for true 0-1 normalization. A score of 1 (worst) = 0.0, score of 5 (best) = 1.0. Document this explicitly in the eval file.

## Project Constraints (from CLAUDE.md)

- **Runtime**: Claude Code sessions only -- no separate API keys, no external services, no Python scripts
- **Target model**: Haiku 4.5
- **Accuracy threshold**: 92%+ (0.92 normalized)
- **Language style**: Normalized casual business language
- **File tracking**: All artifacts are JSON/markdown files tracked in git
- **No GSD bypass**: Do not make direct repo edits outside a GSD workflow unless explicitly asked

## Sources

### Primary (HIGH confidence)
- `scenarios/icp-classification/scenario.json` -- rubric dimensions, weights, output schema, config
- `scenarios/icp-classification/ground-truth/*.json` -- 9 approved ground truth files with input + expected_output
- `.planning/research/ARCHITECTURE.md` -- full architecture patterns, data flow, file formats
- `.planning/research/STACK.md` -- mutation strategies, evaluation approach, stack decisions
- `.planning/research/PITFALLS.md` -- 11 documented pitfalls with mitigations

### Secondary (MEDIUM confidence)
- `.planning/phases/01-scenario-foundation-ground-truth/01-02-SUMMARY.md` -- Phase 1 completion state, consistency check results
- G-Eval pattern (chain-of-thought judging with calibration) -- from STACK.md research sources
- DSPy SIMBA documentation -- multi-run voting and self-reflective evaluation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components use CC-native capabilities, no external dependencies
- Architecture: HIGH -- patterns derived from proven research-process-builder + CONTEXT.md locked decisions
- Pitfalls: HIGH -- well-documented in prior research (PITFALLS.md), supplemented with Phase 2-specific risks

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain, no moving parts)
