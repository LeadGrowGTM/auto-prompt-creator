# Phase 1: Scenario Foundation + Ground Truth - Research

**Researched:** 2026-03-30
**Domain:** File-based scenario definition + Opus-generated ground truth for prompt optimization
**Confidence:** HIGH

## Summary

Phase 1 is pure file structure and methodology. No code, no scripts, no runtime. The deliverables are: (1) a finalized `scenario.json` schema, (2) a ground truth file format with consistency checking, (3) a train/validation split convention, (4) input file conventions, and (5) the SKILL.md sections that tell a CC operator how to define scenarios and generate ground truth.

The research-process-builder (RPB) provides a proven pattern: one JSON file per test case in `ground-truth/`, a `schema.json` for structural validation, and tiered sample companies. This system adapts that pattern with two key differences: the output schema is dynamic (fields defined per-scenario, not hardcoded), and ground truth includes a consistency check (generate twice, flag disagreements).

**Primary recommendation:** Follow RPB's one-file-per-test-case pattern exactly. Use JSON (not YAML) for scenario definitions and ground truth per the locked decision. Keep the scenario directory fully self-contained and portable.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Scenario definition uses JSON (scenario.json)
- **D-02:** Each scenario is a self-contained directory with known file structure (scenario.json, inputs/, ground-truth/, prompts/, evals/, library/)
- **D-03:** scenario.json contains: task description, input/output schema (dynamic per scenario), rubric dimensions with weights, config (target model, accuracy threshold, max iterations, token budget)
- **D-04:** Output schema is dynamic -- the prompt defines what fields to extract, not the scenario. Scenario defines the expected shape/structure but field names come from the task.
- **D-05:** Batch generation with inline review -- Opus generates all ground truth outputs, then user reviews the full set for consistency before approving
- **D-06:** Ground truth stored as individual JSON files (one per input) in ground-truth/ subdirectory
- **D-07:** Each ground truth file contains: input reference, expected output, generation timestamp, approval status
- **D-08:** Consistency check: generate ground truth twice for each input, flag any where outputs disagree materially (not just phrasing). User resolves disagreements.
- **D-09:** Default 60/40 train/validation split, configurable per scenario in scenario.json
- **D-10:** Split is deterministic (seeded) so reruns produce the same split
- **D-11:** Split happens after ground truth approval, before optimization begins
- **D-12:** With 5-10 inputs, expect 3-6 train and 2-4 validation examples
- **D-13:** All ground truth outputs use normalized casual business language ("CMOs" not "Chief Marketing Officers")
- **D-14:** The rubric includes a "style" dimension (weight ~0.15-0.2) to enforce casual language

### Claude's Discretion
- Exact JSON schema field names and nesting in scenario.json
- Directory naming conventions (kebab-case, date prefixes, etc.)
- How to handle edge cases in ground truth generation (ambiguous inputs, companies with insufficient information)
- Whether to include a README.md template per scenario directory

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCEN-01 | User can define a scenario as a directory with scenario.json containing task description, input/output schema, rubric dimensions with weights, and config | Architecture patterns section provides the complete schema; RPB schema.json provides the proven pattern for field-level definitions |
| SCEN-02 | User can provide N source inputs (5-10) as individual files within the scenario directory | Input file format section covers individual file conventions; RPB's one-file-per-case pattern applies |
| SCEN-03 | Scenario supports dynamic output schemas -- prompt defines fields, not scenario | Dynamic schema pattern section addresses how the scenario declares shape while leaving field semantics to the prompt |
| GT-01 | Opus generates gold-standard outputs for each source input within the CC session | Ground truth generation flow section details the batch generation methodology |
| GT-02 | Ground truth files stored as individual JSON files (one per input) with input and expected output | Ground truth file format provides the exact JSON structure |
| GT-03 | Human review checkpoint exists before optimization begins | SKILL.md checkpoint pattern section covers the review gate |
| GT-04 | Ground truth generation includes consistency check (generate twice, flag disagreements) | Consistency checking section details the dual-generation methodology |
| GT-05 | Inputs split into train/validation sets (configurable ratio, default 60/40) | Train/validation split section covers deterministic seeded splitting |

</phase_requirements>

## Architecture Patterns

### Recommended Directory Structure

```
scenarios/
  {scenario-name}/           # kebab-case, descriptive name
    scenario.json            # Scenario definition (task, schema, rubric, config)
    inputs/
      {input-id}.json        # Individual source inputs (one per file)
    ground-truth/
      {input-id}.json        # Opus-generated expected output per input
    prompts/                 # Created in Phase 2, but directory exists from start
    evals/                   # Created in Phase 2
    library/                 # Created in Phase 4
```

**Naming convention recommendation:** kebab-case for scenario directory names (e.g., `icp-classification`, `lead-scoring`). Input IDs should be slugified from the primary identifier (e.g., `dbs-building-solutions`, `abacus-ai`).

### Pattern 1: Self-Contained Scenario Directory

**What:** Everything needed to understand, run, and evaluate a scenario lives in its directory. No references to external config, no shared state across scenarios.
**When:** Always. This is the portability guarantee from D-02.
**Why:** Copy the directory to another machine, another project, another CC session -- it works. RPB's ground-truth/ directory follows this exact pattern: each company's ground truth file contains the company name, domain, tier, verified date, and all expected outputs. Zero external dependencies.

### Pattern 2: Input File Separation from Ground Truth

**What:** Raw inputs live in `inputs/`. Ground truth (input + expected output) lives in `ground-truth/`. The ground truth file references the input by ID, not by embedding a copy.
**Why this matters:** Inputs are provided by the user and never change. Ground truth is generated by Opus and may be regenerated, corrected, or versioned. Keeping them separate means you can regenerate ground truth without touching inputs, and you can add new inputs without regenerating existing ground truth.

**Alternative considered:** Embedding the full input inside the ground truth file (as shown in ARCHITECTURE.md examples). This is simpler but violates DRY -- if the input description changes, you'd have to update it in two places. The RPB stripe.json embeds all data in one file, but RPB inputs don't change. For our use case where inputs might be refined, separation is better.

**Recommendation:** Include input reference (ID) in ground truth, but ALSO embed a copy of the input for portability. The ground truth file should be readable standalone without needing to cross-reference the inputs/ directory. This matches RPB's pattern where each ground truth file is self-contained.

### Pattern 3: Dynamic Output Schema Declaration

**What:** The scenario.json declares the output schema as a structural template with descriptions, not as rigid field validation. The prompt being optimized defines the actual field semantics.
**When:** Per D-04, always.
**Example from ARCHITECTURE.md:**
```json
{
  "output_schema": {
    "industry": "string -- casual label",
    "company_size": "string -- casual label",
    "decision_makers": "string[] -- casual titles",
    "pain_points": "string[] -- specific, not generic",
    "icp_fit": "strong | moderate | weak",
    "reasoning": "string -- one sentence why"
  }
}
```
**Key insight:** The schema tells the judge WHAT fields to expect and HOW to score them. But the prompt teaches Haiku HOW to populate them. The schema is a contract, not an instruction.

### Anti-Patterns to Avoid

- **Monolithic ground truth file:** One big JSON array with all test cases. Kills diffability, creates merge conflicts, makes per-case review impossible.
- **Inputs embedded only in scenario.json:** Makes the scenario.json huge and hard to read. Inputs are data; scenario.json is configuration.
- **Hardcoded field names in system-level code:** The system should work with ANY output schema, not just ICP classification fields.
- **Skipping the consistency check:** D-08 exists because Opus labels inconsistently (Pitfall 5). Generating twice is cheap insurance.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deterministic split | Custom random logic | Seed-based shuffle from sorted input IDs | Alphabetically sort IDs, use a fixed seed (scenario name hash), split at the ratio boundary. Deterministic without complexity. |
| JSON schema validation | Custom validator | Structural convention + Opus as validator | The "validator" is Opus reading the schema and checking the ground truth. No code needed in a file-based system. |
| Ground truth diffing | Custom diff tool | `git diff` on individual JSON files | One file per test case means git handles diffing for free. |
| Consistency scoring | Fuzzy matching logic | Opus comparison | When checking if two ground truth generations agree, Opus does the semantic comparison. "CMOs" and "marketing leaders" might both be acceptable. |

## Common Pitfalls

### Pitfall 1: Ground Truth Inconsistency (from PITFALLS.md #5)

**What goes wrong:** Opus generates "mid-market" for one 150-person company and "SMB" for another 150-person company. The optimizer can never converge because the ground truth contradicts itself.
**Why it happens:** Opus makes judgment calls. Without explicit label definitions, it freestyles. Two generation passes can produce different labels for the same input.
**How to avoid:**
1. Define canonical labels in scenario.json (e.g., "company_size must be one of: startup, SMB, mid-market, enterprise, mega-corp")
2. Generate ground truth twice (D-08) and flag disagreements
3. Human reviews the full set TOGETHER (D-05) to catch inconsistencies that per-case review misses
4. Include a "label_definitions" section in scenario.json that constrains allowed values
**Warning signs:** Ground truth generated quickly without human review. No consistency check performed. Allowed values not defined.

### Pitfall 2: Insufficient Input Diversity

**What goes wrong:** All 8 input companies are mid-market B2B SaaS. The prompt optimizes for that profile and fails on manufacturing, services, or enterprise companies.
**Why it happens:** The first scenario uses real companies from one client's pipeline, which are naturally clustered.
**How to avoid:**
1. Deliberately include diversity across: industry, company size, ICP fit (strong + weak + moderate), information density (detailed description vs. sparse)
2. The first scenario's 8 companies (DBS Building Solutions, TRX Services, OSP, Bartos Industries, ROUSH CleanTech, Wisconsin Plastics, Abacus AI, Dealer Teamwork, Title One) already have good diversity -- manufacturing, services, tech, automotive. Preserve this.
3. Include at least 1-2 "weak fit" companies so the prompt learns to say "weak" not just "strong"
**Warning signs:** All ground truth icp_fit values are "strong". All industries are similar. All company sizes are the same tier.

### Pitfall 3: Overly Complex Initial Schema

**What goes wrong:** The output schema has 15 fields, 8 of which are subjective. The judge can't reliably score this many dimensions, and the mutation engine doesn't know which fields to prioritize.
**Why it happens:** Feature creep during scenario definition. "While we're at it, let's also classify their tech maturity and buying stage."
**How to avoid:** Start with 4-6 output fields. ICP classification schema in ARCHITECTURE.md has exactly 6 fields. That's the sweet spot for the first scenario.
**Warning signs:** Output schema has nested objects. More than 3 rubric dimensions for 6 output fields.

### Pitfall 4: Train/Validation Split Too Small to Be Meaningful

**What goes wrong:** With 5 inputs and 60/40 split, you get 3 train and 2 validation. Validation accuracy is either 0%, 50%, or 100%. The signal is too noisy to detect overfitting.
**Why it happens:** Tiny datasets are the reality of this system. 5-10 inputs is the design constraint.
**How to avoid:**
1. Target 8-10 inputs minimum for the first scenario (the 9 companies listed provide this)
2. With 9 inputs at 60/40: 5 train, 4 validation. Still coarse but 4 validation points gives 0/25/50/75/100% resolution.
3. Accept that overfitting detection will be coarse. The split is a sanity check, not a statistical test.
4. Document this limitation explicitly in SKILL.md so users understand the tradeoff.
**Warning signs:** Fewer than 8 inputs. Validation set has fewer than 3 examples.

## Code Examples

### scenario.json -- Complete Schema

```json
{
  "name": "icp-classification",
  "description": "Classify companies into ICP segments from company descriptions using casual, normalized business language",
  "created": "2026-03-30",
  "version": 1,
  "config": {
    "target_model": "haiku",
    "accuracy_threshold": 0.92,
    "max_iterations": 15,
    "token_budget": 800,
    "train_validation_split": 0.6,
    "split_seed": "icp-classification"
  },
  "input_schema": {
    "company_name": { "type": "string", "required": true },
    "company_description": { "type": "string", "required": true },
    "website_url": { "type": "string", "required": false }
  },
  "output_schema": {
    "industry": {
      "type": "string",
      "description": "Casual industry label (e.g., 'commercial cleaning' not 'janitorial services')"
    },
    "company_size": {
      "type": "string",
      "description": "Casual size label",
      "allowed_values": ["startup", "SMB", "mid-market", "enterprise"]
    },
    "decision_makers": {
      "type": "string[]",
      "description": "Casual titles (e.g., 'CMOs' not 'Chief Marketing Officers')"
    },
    "pain_points": {
      "type": "string[]",
      "description": "Specific to this company, not generic"
    },
    "icp_fit": {
      "type": "string",
      "allowed_values": ["strong", "moderate", "weak"]
    },
    "reasoning": {
      "type": "string",
      "description": "One sentence explaining the fit classification"
    }
  },
  "rubric": {
    "dimensions": {
      "accuracy": {
        "weight": 0.4,
        "description": "Fields are factually correct given the input. Industry matches, size is right, decision makers are plausible."
      },
      "label_normalization": {
        "weight": 0.25,
        "description": "Uses casual, normalized business language. No corporate jargon, no full title expansions, no formal industry taxonomy."
      },
      "completeness": {
        "weight": 0.2,
        "description": "All required fields present with substantive values. No 'N/A' or placeholder answers."
      },
      "specificity": {
        "weight": 0.15,
        "description": "Pain points and reasoning are specific to this company, not generic filler."
      }
    },
    "scoring": "1-5 per dimension, weighted average normalized to 0-1. 5 = indistinguishable from Opus output. 1 = wrong or missing."
  },
  "label_definitions": {
    "company_size": {
      "startup": "Pre-revenue or <20 employees, early stage",
      "SMB": "20-200 employees, established but not scaled",
      "mid-market": "200-2000 employees, multiple departments",
      "enterprise": "2000+ employees, complex org structure"
    },
    "icp_fit": {
      "strong": "Matches target ICP on industry, size, and pain points",
      "moderate": "Matches on 1-2 dimensions, unclear on others",
      "weak": "Does not match target ICP on key dimensions"
    }
  }
}
```

### inputs/{input-id}.json -- Input File Format

```json
{
  "id": "dbs-building-solutions",
  "company_name": "DBS Building Solutions",
  "company_description": "Commercial cleaning and facility maintenance company serving corporate offices, medical facilities, and industrial sites across the Midwest. 340 employees, $28M revenue. Uses ServiceTitan for dispatch and has struggled to scale their quality assurance process.",
  "website_url": "https://dbsbuildingsolutions.com"
}
```

### ground-truth/{input-id}.json -- Ground Truth File Format

```json
{
  "id": "dbs-building-solutions",
  "input_ref": "dbs-building-solutions",
  "input": {
    "company_name": "DBS Building Solutions",
    "company_description": "Commercial cleaning and facility maintenance company serving corporate offices, medical facilities, and industrial sites across the Midwest. 340 employees, $28M revenue. Uses ServiceTitan for dispatch and has struggled to scale their quality assurance process.",
    "website_url": "https://dbsbuildingsolutions.com"
  },
  "expected_output": {
    "industry": "commercial cleaning",
    "company_size": "mid-market",
    "decision_makers": ["ops directors", "facility managers", "regional managers"],
    "pain_points": [
      "scaling QA across multiple sites and service types",
      "dispatch complexity with ServiceTitan limitations",
      "maintaining consistency across medical vs office vs industrial standards"
    ],
    "icp_fit": "strong",
    "reasoning": "Mid-market commercial cleaning with multi-vertical complexity. Ops-heavy, needs automation, has budget."
  },
  "generation": {
    "model": "opus",
    "timestamp": "2026-03-30T14:00:00Z",
    "consistency_check": {
      "pass_1_hash": "a1b2c3",
      "pass_2_hash": "d4e5f6",
      "agreement": true,
      "disagreements": []
    }
  },
  "review": {
    "status": "approved",
    "reviewed_by": "human",
    "reviewed_date": "2026-03-30",
    "notes": ""
  },
  "split": "train"
}
```

### Consistency Check -- Disagreement Example

```json
{
  "consistency_check": {
    "pass_1_hash": "a1b2c3",
    "pass_2_hash": "x7y8z9",
    "agreement": false,
    "disagreements": [
      {
        "field": "company_size",
        "pass_1": "SMB",
        "pass_2": "mid-market",
        "resolution": "human",
        "resolved_value": "mid-market",
        "rationale": "340 employees puts them solidly in mid-market per label definitions"
      }
    ]
  }
}
```

## Ground Truth Generation Flow

### Step 1: Validate Inputs

Before generating ground truth, Opus reads all input files and validates:
- All required fields present per input_schema
- Input diversity is sufficient (flag if all same industry, size, or likely fit)
- Company descriptions have enough information for meaningful classification

### Step 2: Batch Generate (Pass 1)

Opus processes all inputs in sequence, producing expected_output for each. Key rules:
- Follow label_definitions from scenario.json (use canonical labels, not freestyled ones)
- Use normalized casual language per D-13
- Write pain_points that reference specific details from the company description
- Set icp_fit with one-sentence reasoning

### Step 3: Batch Generate (Pass 2)

Opus regenerates expected_output for all inputs independently (no looking at Pass 1 results). This is the consistency check per D-08.

### Step 4: Compare and Flag

For each input, compare Pass 1 and Pass 2 outputs:
- Field-by-field comparison using semantic equivalence (not string matching)
- "CMOs" vs "marketing leaders" = agreement (phrasing difference)
- "mid-market" vs "SMB" = disagreement (material difference)
- Flag all disagreements with both values

### Step 5: Human Review

Present the full batch to the user (D-05 inline review):
- Show all ground truth outputs together (not one at a time)
- Highlight any flagged disagreements with both candidate values
- User approves, edits, or resolves disagreements
- Mark each ground truth file with review status

### Step 6: Assign Split Labels

After approval:
1. Sort input IDs alphabetically
2. Hash the scenario name to get a seed value
3. Use the seed to shuffle the sorted list deterministically
4. Split at the configured ratio (default 60%)
5. Write the "split" field ("train" or "validation") into each ground truth file

## Train/Validation Split Implementation

**Deterministic split algorithm (no code required -- Opus follows this):**

1. Collect all approved ground truth input IDs
2. Sort alphabetically: `["abacus-ai", "bartos-industries", "dbs-building-solutions", ...]`
3. Use scenario name as seed for consistent ordering
4. Assign first N * split_ratio to "train", remainder to "validation"
5. With 9 inputs at 0.6 split: 5 train, 4 validation

**Why deterministic matters:** If someone re-runs the split (e.g., after adding a ground truth file and re-splitting), the existing assignments should be stable. New inputs slot into the sorted order; existing ones keep their assignment as long as the total count doesn't change dramatically.

**Edge case:** Adding a 10th input changes the split boundary. With 10 at 0.6: 6 train, 4 validation. Some inputs may flip from validation to train. This is acceptable -- the split is pre-optimization, so no contamination risk.

## Edge Case Handling (Claude's Discretion)

### Ambiguous Inputs

When a company description is too sparse to classify reliably (e.g., "Software company, founded 2022"):
- Generate ground truth with best-effort classification
- Add a note in the ground truth file: `"confidence": "low"`, `"notes": "Sparse input -- classification is speculative"`
- Flag for human review explicitly
- Consider adding more information to the input or removing the example

### Companies That Don't Fit Any ICP

Include at least 1-2 "weak fit" companies in ground truth. The prompt needs to learn when to say "weak" not just "strong" or "moderate". This prevents the dominant-class gaming described in Pitfall 8 of PITFALLS.md.

### README.md Per Scenario

**Recommendation: Yes, include one.** A lightweight README.md template per scenario directory that captures:
- What this scenario optimizes for (one sentence)
- Current status (defining / generating GT / optimizing / graduated)
- Number of inputs, current accuracy, best prompt version
- Created date, last modified

This is cheap to maintain and invaluable when returning to a scenario after time away.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single ground truth generation | Dual generation + consistency check | This project | Catches Opus labeling inconsistency before it poisons the loop |
| Monolithic test data files | One file per test case | RPB pattern (proven) | Clean diffs, independent editing, easy to add/remove cases |
| Hardcoded output schemas | Dynamic per-scenario schemas | This project (D-04) | System works for any classification/extraction task, not just ICP |
| Holistic quality scoring | Weighted multi-dimension rubrics | autocontext + Evidently patterns | Actionable failure analysis -- know WHAT is wrong, not just "low score" |

## Open Questions

1. **Hash function for split seed**
   - What we know: The seed should be derived from the scenario name for determinism
   - What's unclear: Whether a simple hash (sum of char codes) is sufficient or if a proper hash function is needed
   - Recommendation: Use the scenario name string directly as a conceptual seed. Opus can sort and assign deterministically without needing actual hash computation. Document the algorithm in SKILL.md so it's reproducible.

2. **Ground truth file size with embedded input**
   - What we know: Embedding the full input in the ground truth file improves portability
   - What's unclear: For scenarios with very long inputs (multi-page documents), this could make ground truth files unwieldy
   - Recommendation: Embed for now. The first scenario has short company descriptions. Add a "large input" convention (external reference) if needed later.

3. **Consistency check threshold**
   - What we know: D-08 says flag disagreements that are "material, not just phrasing"
   - What's unclear: The boundary between material and phrasing differences requires judgment
   - Recommendation: Let Opus make the judgment call during comparison. Document that "CMOs" vs "marketing leaders" = agreement, but "mid-market" vs "SMB" = disagreement. Provide 2-3 examples in SKILL.md.

## Sources

### Primary (HIGH confidence)
- `research-process-builder/ground-truth/schema.json` -- Proven ground truth schema pattern (680 lines, 20+ categories, field-level type definitions)
- `research-process-builder/ground-truth/stripe.json` -- Complete example ground truth file with verified data structure
- `research-process-builder/SKILL.md` -- Interactive skill pattern with checkpoints, ground truth training pattern, tiered validation
- `.planning/research/ARCHITECTURE.md` -- Complete file format specifications, data flow, component boundaries
- `.planning/research/PITFALLS.md` -- Ground truth quality risks (Pitfall 5), overfitting setup (Pitfall 1), judge reliability (Pitfall 2)

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` -- Feature landscape, competitive analysis, dependency graph
- autocontext AgentTaskSpec pattern -- Rubric dimensions, weighted scoring (adapted, not directly reused)

## Metadata

**Confidence breakdown:**
- Scenario file format: HIGH -- directly adapted from proven RPB pattern with locked decisions constraining the design
- Ground truth generation flow: HIGH -- RPB's ground truth training pattern is validated; consistency check is a well-documented improvement
- Train/validation split: MEDIUM -- 60/40 on tiny datasets is more of a sanity check than statistical rigor. DSPy recommends 20/80 for prompt optimization, but user locked 60/40 as default.
- Edge case handling: MEDIUM -- recommendations are sound but untested until the first scenario runs

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- file format decisions don't expire quickly)
