# Architecture Patterns

**Domain:** File-based prompt optimization system (runs inside Claude Code)
**Researched:** 2026-03-30
**Confidence:** HIGH (derived from proven research-process-builder patterns + autocontext concepts)

## Recommended Architecture

The system is structured files + a methodology document (SKILL.md) that a Claude Code session follows. There is no runtime, no scripts, no API calls. The CC session IS the engine. Opus orchestrates, Haiku executes candidate prompts via agent spawning.

### Directory Structure

```
auto-prompt-creator/
├── SKILL.md                          # The methodology — how to run the optimization loop
├── scenarios/
│   └── {scenario-name}/
│       ├── scenario.json             # Scenario definition (inputs, schema, rubric, config)
│       ├── ground-truth/
│       │   ├── {input-id}.json       # Individual ground truth: input + expected output
│       │   └── ...
│       ├── prompts/
│       │   ├── v001.md               # Prompt version 1 (the candidate prompt text)
│       │   ├── v002.md               # Prompt version 2 (mutated from v001)
│       │   └── ...
│       ├── evals/
│       │   ├── v001.json             # Evaluation results for prompt v001
│       │   ├── v002.json             # Evaluation results for prompt v002
│       │   └── ...
│       ├── mutations.log             # Append-only log of what changed between versions and why
│       └── BEST.md                   # Symlink/copy of the current best prompt (convenience)
└── library/
    └── {scenario-name}.md            # Graduated prompts — the finished product
```

### Component Boundaries

| Component | Responsibility | Format |
|-----------|---------------|--------|
| `SKILL.md` | Methodology: how to define scenarios, generate ground truth, run the anneal loop, judge, mutate. The human reads this, CC follows it. | Markdown (interactive skill pattern) |
| `scenarios/{name}/scenario.json` | Scenario definition: what task the prompt solves, input shape, output schema, rubric dimensions, config (target accuracy, max iterations, target model) | JSON |
| `scenarios/{name}/ground-truth/*.json` | Individual test cases: one input + one Opus-generated expected output per file | JSON |
| `scenarios/{name}/prompts/v{NNN}.md` | A complete prompt version. Pure text that gets sent to Haiku. Diffable between versions. | Markdown |
| `scenarios/{name}/evals/v{NNN}.json` | Structured evaluation results: per-input scores, per-dimension scores, aggregate accuracy, failure analysis | JSON |
| `scenarios/{name}/mutations.log` | Append-only changelog: what mutation was applied, why, which failures it targets | Plain text log |
| `library/{name}.md` | Graduated prompts that hit the accuracy threshold. The deliverable. | Markdown |

## Data Flow

### The Full Loop (5 stages)

```
1. DEFINE          2. GROUND TRUTH       3. CANDIDATE RUN
scenario.json  -->  Opus generates   -->  Haiku runs prompt
(input schema,      expected outputs      against each input
 output schema,     for each input        via CC agent spawn
 rubric)            (ground-truth/*.json) (prompts/v001.md)
                                              |
                                              v
                    5. MUTATE             4. JUDGE
                    Opus analyzes    <--  Opus scores Haiku
                    failure patterns      output vs ground truth
                    generates v002        per rubric dimensions
                    (mutations.log)       (evals/v001.json)
                         |
                         v
                    Loop back to step 3 with v002
                    Until accuracy >= threshold
                         |
                         v
                    6. GRADUATE
                    Copy best prompt to library/
```

### Stage Details

**Stage 1: Define (human + Opus)**
The human describes the task. Opus helps structure it into `scenario.json`. This is interactive, following the SKILL.md intake pattern. Key outputs:
- Input schema (what data the prompt receives)
- Output schema (what structure the prompt should produce)
- Rubric dimensions (what "good" means, with weights)
- Config (target model, accuracy threshold, max iterations)
- 5-10 sample inputs (raw data the prompt will process)

**Stage 2: Generate Ground Truth (Opus)**
For each sample input, Opus produces the "perfect" output. These are saved as individual JSON files. The human reviews and corrects them. This is the most important step. Bad ground truth = bad optimization. Ground truth files are the source of truth for the entire loop.

**Stage 3: Candidate Run (Haiku via agent spawn)**
The CC session spawns a Haiku agent with the candidate prompt + one input. Haiku produces output. This repeats for each input in the ground truth set. Results are collected by the orchestrating Opus session.

**Stage 4: Judge (Opus)**
Opus compares each Haiku output against the corresponding ground truth, scoring per rubric dimension. This is LLM-as-judge, not deterministic matching (handles semantic equivalence like "CMOs" = "marketing leadership"). Results are written to `evals/v{NNN}.json`.

**Stage 5: Mutate (Opus)**
Opus analyzes the evaluation results: which inputs failed, which dimensions scored low, what patterns emerge. It generates a targeted mutation to the prompt and saves it as `v{NNN+1}.md`. The mutation rationale is appended to `mutations.log`.

**Stage 6: Graduate**
When accuracy >= threshold, the best prompt is copied to `library/` as a standalone, portable file.

## File Formats

### scenario.json

```json
{
  "name": "icp-classification",
  "description": "Given company descriptions, classify the ICP with casual normalized labels",
  "created": "2026-03-30",
  "config": {
    "target_model": "haiku",
    "accuracy_threshold": 0.92,
    "max_iterations": 15,
    "current_best": "v003"
  },
  "input_schema": {
    "company_name": "string",
    "company_description": "string",
    "website_url": "string (optional)"
  },
  "output_schema": {
    "industry": "string — casual label (e.g., 'commercial cleaning' not 'janitorial services')",
    "company_size": "string — casual label (e.g., 'mid-market' not '200-500 employees')",
    "decision_makers": "string[] — casual titles (e.g., 'CMOs' not 'Chief Marketing Officers')",
    "pain_points": "string[] — specific, not generic",
    "icp_fit": "strong | moderate | weak",
    "reasoning": "string — one sentence why"
  },
  "rubric": {
    "dimensions": {
      "label_normalization": {
        "weight": 0.3,
        "description": "Uses casual, normalized business language. No corporate jargon, no full title expansions, no formal industry taxonomy."
      },
      "accuracy": {
        "weight": 0.4,
        "description": "Fields are factually correct given the input. Industry matches, size is right, decision makers are plausible."
      },
      "completeness": {
        "weight": 0.2,
        "description": "All required fields present with substantive values. No 'N/A' or placeholder answers."
      },
      "specificity": {
        "weight": 0.1,
        "description": "Pain points and reasoning are specific to this company, not generic 'needs better marketing' filler."
      }
    },
    "scoring": "1-5 per dimension, weighted average. 5 = indistinguishable from Opus output. 1 = wrong or missing."
  }
}
```

### ground-truth/{input-id}.json

```json
{
  "id": "acme-corp",
  "input": {
    "company_name": "Acme Cleaning Solutions",
    "company_description": "Commercial cleaning company serving office buildings and medical facilities in the Southeast US. 85 employees, $12M revenue. Uses ServiceTitan for scheduling.",
    "website_url": "https://acmecleaning.com"
  },
  "expected_output": {
    "industry": "commercial cleaning",
    "company_size": "mid-market",
    "decision_makers": ["ops directors", "facility managers", "owners"],
    "pain_points": ["scheduling complexity across multiple sites", "employee turnover and training", "compliance with medical facility standards"],
    "icp_fit": "strong",
    "reasoning": "Mid-market commercial cleaning with medical vertical = high-value, ops-heavy, needs automation."
  },
  "generated_by": "opus",
  "verified_by_human": true,
  "verified_date": "2026-03-30"
}
```

### evals/v{NNN}.json

```json
{
  "prompt_version": "v001",
  "timestamp": "2026-03-30T14:22:00",
  "config": {
    "target_model": "haiku",
    "judge_model": "opus"
  },
  "aggregate": {
    "overall_accuracy": 0.78,
    "dimension_scores": {
      "label_normalization": 0.72,
      "accuracy": 0.85,
      "completeness": 0.82,
      "specificity": 0.68
    },
    "pass_count": 6,
    "fail_count": 2,
    "total": 8
  },
  "per_input": [
    {
      "input_id": "acme-corp",
      "passed": true,
      "weighted_score": 0.84,
      "dimensions": {
        "label_normalization": 4,
        "accuracy": 5,
        "completeness": 4,
        "specificity": 3
      },
      "haiku_output": { "...actual haiku output..." },
      "judge_notes": "Good accuracy. 'Janitorial services' should be 'commercial cleaning'. Pain points too generic."
    },
    {
      "input_id": "techstartup-xyz",
      "passed": false,
      "weighted_score": 0.52,
      "dimensions": {
        "label_normalization": 2,
        "accuracy": 3,
        "completeness": 3,
        "specificity": 2
      },
      "haiku_output": { "...actual haiku output..." },
      "judge_notes": "Used 'Chief Technology Officer' instead of 'CTOs'. Industry too broad ('technology'). Pain points are boilerplate.",
      "failure_pattern": "formal-language-regression"
    }
  ],
  "failure_analysis": {
    "patterns": [
      {
        "pattern": "formal-language-regression",
        "frequency": 3,
        "description": "Haiku reverts to formal titles and industry names despite prompt instructions",
        "affected_inputs": ["techstartup-xyz", "bigcorp-inc", "saas-tool"],
        "suggested_fix": "Add explicit examples of DO/DON'T label pairs in prompt"
      }
    ]
  }
}
```

### mutations.log

```
## v001 -> v002 (2026-03-30T14:35:00)
Target: formal-language-regression (3/8 inputs affected)
Mutation: Added 6 DO/DON'T example pairs for label normalization
         Added "NEVER use full C-suite titles" instruction
         Added "If you catch yourself writing 'Chief X Officer', rewrite as the casual plural"
Score delta: 0.78 -> 0.85 (+0.07)
Dimensions improved: label_normalization (0.72 -> 0.88), specificity (0.68 -> 0.74)

## v002 -> v003 (2026-03-30T15:10:00)
Target: generic-pain-points (2/8 inputs affected)
Mutation: Added "Pain points must reference something specific from the company description"
         Added 2 calibration examples showing generic vs specific pain points
Score delta: 0.85 -> 0.91 (+0.06)
Dimensions improved: specificity (0.74 -> 0.89)
```

### prompts/v{NNN}.md

Pure prompt text. No metadata in the file itself (metadata lives in evals/ and mutations.log). This keeps prompts copy-pasteable and diffable.

```markdown
You are classifying companies into ICP segments. Given a company description, produce a structured classification.

## Rules

- Use casual, normalized business language throughout
- NEVER write "Chief Marketing Officer" — write "CMOs"
- NEVER write "janitorial services and facility management" — write "commercial cleaning"
...

## Output Format

Return JSON with these fields:
...
```

## Patterns to Follow

### Pattern 1: One File Per Test Case (from research-process-builder)
**What:** Each ground truth example is a separate JSON file, not one big array.
**When:** Always. This is how research-process-builder handles its 10 ground truth companies.
**Why:** Individual files are independently editable, reviewable, and diffable. Adding a new test case is adding a file, not editing a massive JSON array. Git diffs are clean.

### Pattern 2: Append-Only Mutation Log (from research-process-builder baselines/)
**What:** Every iteration's rationale is logged, never overwritten.
**When:** Every prompt mutation.
**Why:** The research-process-builder's baselines/ directory has iter1 through iter10, each preserving the full state. The mutations.log serves the same purpose but as a more readable narrative. You can reconstruct the optimization journey from this log alone.

### Pattern 3: Separate Prompt from Metadata (autocontext-inspired)
**What:** Prompt text lives in .md files. Scores and config live in .json files. Never mix them.
**When:** Always. Prompts are authored/edited text. Evals are structured data.
**Why:** Prompts need to be diffable (what changed between v001 and v002?). Evals need to be parseable (what's the score trend?). Mixing them makes both worse.

### Pattern 4: Failure Pattern Taxonomy
**What:** Each eval identifies named failure patterns (e.g., "formal-language-regression"), not just low scores.
**When:** During the judge step.
**Why:** Named patterns make mutations targeted. "Score is low" is useless. "Haiku reverts to formal language in 3/8 cases" is actionable. The mutation targets the named pattern specifically.

### Pattern 5: Rubric Dimensions with Weights (from autocontext)
**What:** Quality is scored on 3-5 named dimensions, each with a weight.
**When:** Defined in scenario.json, used in every eval.
**Why:** Overall accuracy hides where the prompt is weak. Dimension scores tell you exactly what to fix. Weights let the scenario owner define what matters most.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Ground Truth File
**What:** Putting all test cases in one big JSON array.
**Why bad:** Every edit touches the same file. Git conflicts. Hard to review individual cases. Can't selectively re-run one case.
**Instead:** One file per test case in ground-truth/ directory.

### Anti-Pattern 2: Overwriting Prompt Versions
**What:** Editing v001.md in place instead of creating v002.md.
**Why bad:** Loses the optimization history. Can't diff between versions. Can't roll back.
**Instead:** Immutable versions. Always create v{NNN+1}.md. The mutations.log explains what changed.

### Anti-Pattern 3: Deterministic String Matching for Scoring
**What:** Checking if Haiku output exactly matches ground truth strings.
**Why bad:** "CMOs" and "marketing leadership" and "heads of marketing" might all be acceptable. Semantic equivalence requires LLM judgment.
**Instead:** LLM-as-judge (Opus) scores each output against ground truth, handling semantic equivalence.

### Anti-Pattern 4: Huge Ground Truth Sets
**What:** Creating 50+ test cases before the first iteration.
**Why bad:** Ground truth generation is expensive (Opus time + human review). Most optimization signal comes from 5-8 diverse cases. research-process-builder uses 10 companies across 3 tiers and that's sufficient for 90%+ processes.
**Instead:** Start with 5-8 test cases spanning the diversity of the input space. Add targeted cases only when failure patterns reveal gaps.

### Anti-Pattern 5: Blind Mutation (Changing the Prompt Without Analyzing Failures)
**What:** Rewriting the prompt based on gut feel after seeing a low score.
**Why bad:** Undirected changes often regress other dimensions while fixing one.
**Instead:** Always analyze failure patterns first. Name the pattern. Target the mutation at that specific pattern. Check that other dimensions didn't regress.

## The CC Session as Orchestrator

This is the key architectural decision. There are no scripts. The Claude Code session running Opus IS the orchestrator. Here's how each stage maps to CC actions:

| Stage | CC Action | Model |
|-------|-----------|-------|
| Define scenario | Interactive conversation, write scenario.json | Opus (main session) |
| Generate ground truth | Read input, produce expected output, write to file | Opus (main session) |
| Run candidate prompt | Spawn Haiku agent with prompt + input, collect output | Haiku (spawned agent) |
| Judge output | Compare Haiku output vs ground truth per rubric, write eval | Opus (main session) |
| Mutate prompt | Analyze failures, generate new prompt version, log mutation | Opus (main session) |
| Graduate | Copy best prompt to library/ | Opus (main session) |

**The SKILL.md file tells the human operator how to drive this loop.** It's an interactive skill with checkpoints (same pattern as research-process-builder's SKILL.md). The human says "run the next iteration" and Opus handles steps 3-5 autonomously, pausing at checkpoints for human review.

**Agent spawning for Haiku:** The critical constraint. CC can spawn subagents with a specified model. The prompt version file becomes the system prompt for the spawned Haiku agent. The input from ground truth becomes the user message. Haiku's response is the candidate output. This is how we get Haiku execution without API calls.

## Suggested Build Order

Dependencies drive the order. Each phase produces artifacts the next phase consumes.

### Phase 1: Scenario Definition + Ground Truth (foundation)
- `scenario.json` format and validation
- `ground-truth/*.json` format
- Interactive intake flow in SKILL.md (define scenario, generate ground truth, human review)
- **Depends on:** nothing
- **Produces:** the test harness

### Phase 2: Candidate Execution + Evaluation (the measurement layer)
- Prompt execution via Haiku agent spawning
- LLM-as-judge evaluation (Opus scores vs ground truth)
- `evals/v{NNN}.json` format
- Failure pattern identification
- **Depends on:** Phase 1 (needs ground truth to evaluate against)
- **Produces:** the ability to measure prompt quality

### Phase 3: Mutation Engine + Anneal Loop (the optimization)
- Failure analysis methodology
- Targeted prompt mutation generation
- `mutations.log` format
- Loop logic (iterate until threshold or max iterations)
- Checkpoint pattern (human approves/redirects between iterations)
- **Depends on:** Phase 2 (needs evaluation results to know what to fix)
- **Produces:** the optimization capability

### Phase 4: Graduation + Library (the deliverable)
- Best prompt selection and graduation criteria
- `library/` format for portable prompts
- Scenario archival and documentation
- **Depends on:** Phase 3 (needs a prompt that passed the threshold)
- **Produces:** the finished, portable prompt

## Scalability Considerations

| Concern | At 1 scenario | At 5 scenarios | At 20+ scenarios |
|---------|---------------|----------------|------------------|
| Ground truth management | Manual review per case | Reuse patterns across similar scenarios | Template ground truth generators per domain |
| Iteration speed | ~5 min per iteration (8 inputs) | Same per scenario, but total time grows | Batch similar scenarios, share rubric dimensions |
| Prompt version sprawl | 5-15 versions typical | Same per scenario | Archive old scenarios, keep only library/ prompts |
| CC context window | Fits easily | Load one scenario at a time | SKILL.md stays loaded, swap scenario context |

## Sources

- research-process-builder (C:/Users/mitch/Everything_CC/research-process-builder/) — proven anneal loop architecture, ground truth format, iteration tracking. HIGH confidence.
- autocontext AgentTaskSpec pattern — rubric dimensions, weighted scoring, improvement loop concept. MEDIUM confidence (concepts adapted, not directly reused).
- Claude Code agent spawning — verified capability for running Haiku as subagent within CC session. HIGH confidence.
