# Requirements: Auto Prompt Creator

## v1 Requirements

### Scenario Definition
- [x] **SCEN-01**: User can define a scenario as a directory with a scenario.json file containing task description, input/output schema, rubric dimensions with weights, and config (target model, accuracy threshold, max iterations)
- [x] **SCEN-02**: User can provide N source inputs (5-10) as individual files within the scenario directory
- [x] **SCEN-03**: Scenario supports dynamic output schemas — the prompt defines what fields to extract, not the scenario

### Ground Truth
- [x] **GT-01**: Opus generates gold-standard outputs for each source input within the CC session
- [x] **GT-02**: Ground truth files are stored as individual JSON files (one per input) with the input and expected output
- [x] **GT-03**: Human review checkpoint exists before optimization begins — ground truth must be approved
- [x] **GT-04**: Ground truth generation includes consistency check (generate twice, flag disagreements)
- [x] **GT-05**: Inputs are split into train/validation sets (configurable ratio, default 60/40) to detect overfitting

### Execution
- [x] **EXEC-01**: Candidate prompts are executed against Haiku via CC agent spawning
- [x] **EXEC-02**: Raw Haiku output is captured and parsed into structured form
- [x] **EXEC-03**: Parse failures are handled gracefully (logged, scored as 0, not crash)

### Evaluation
- [x] **EVAL-01**: Opus judges Haiku output against ground truth using a multi-dimension rubric (accuracy, completeness, style)
- [x] **EVAL-02**: Evaluation results stored as structured JSON per iteration (per-input scores, per-dimension scores, aggregate accuracy)
- [x] **EVAL-03**: Judge uses concrete pass/fail examples from the rubric (calibration anchors)
- [x] **EVAL-04**: Multi-run voting (3 judge runs, median score) to reduce scoring noise

### Mutation
- [x] **MUT-01**: Failure-driven mutation — analyze what went wrong across test cases, generate targeted prompt improvements (SIMBA-style)
- [x] **MUT-02**: Failure taxonomy — categorize failures into named patterns (e.g., "formal-language-regression", "missing-field", "hallucinated-data")
- [x] **MUT-03**: Mutations include both additive (add instructions) and subtractive (remove/simplify instructions)
- [x] **MUT-04**: Token budget enforcement — prompt length capped (default 800 tokens for Haiku) with consolidation passes when approaching limit

### Loop Control
- [x] **LOOP-01**: Anneal loop runs until accuracy >= threshold (default 92%) or max iterations (default 15)
- [x] **LOOP-02**: Convergence detection — halt if score delta < min_gain for 3 consecutive iterations
- [x] **LOOP-03**: Train vs validation accuracy tracked separately — halt if gap exceeds 8% (overfitting signal)
- [x] **LOOP-04**: Semantic drift check every 3-5 iterations — verify prompt still aligns with original task intent

### Tracking
- [x] **TRACK-01**: Each prompt version stored as an immutable file (prompts/v001.md, v002.md, etc.)
- [x] **TRACK-02**: Mutations logged in append-only mutations.log with: what changed, why, which failure pattern targeted, score delta
- [x] **TRACK-03**: All prompt iterations and evaluations are git-committed for diffable lineage

### Graduation
- [ ] **GRAD-01**: Prompts hitting the accuracy threshold graduate to library/ as named, portable files
- [ ] **GRAD-02**: Graduated prompt includes metadata: scenario name, accuracy score, iterations needed, test set size, date

## v2 Requirements (Deferred)

- Few-shot example selection automation
- Multi-model targeting (optimize for Sonnet or other models)
- Scenario templates for common use cases (classification, extraction, summarization)
- Cross-scenario learning (patterns that improved one scenario might help another)
- Batch scenario processing (run optimization on multiple scenarios sequentially)

## Out of Scope

- Web UI / dashboard — file-based, terminal-native
- External API integration — CC-only, zero external billing
- Fine-tuning / weight optimization — pure prompt optimization
- CI/CD pipeline integration — manual workflow via CC skill
- Multi-model comparison in single run — one target model per scenario
- Template interpolation engine — raw prompt text, CC handles execution

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SCEN-01 | Phase 1 | Complete |
| SCEN-02 | Phase 1 | Complete |
| SCEN-03 | Phase 1 | Complete |
| GT-01 | Phase 1 | Complete |
| GT-02 | Phase 1 | Complete |
| GT-03 | Phase 1 | Complete |
| GT-04 | Phase 1 | Complete |
| GT-05 | Phase 1 | Complete |
| EXEC-01 | Phase 2 | Complete |
| EXEC-02 | Phase 2 | Complete |
| EXEC-03 | Phase 2 | Complete |
| EVAL-01 | Phase 2 | Complete |
| EVAL-02 | Phase 2 | Complete |
| EVAL-03 | Phase 2 | Complete |
| EVAL-04 | Phase 2 | Complete |
| TRACK-01 | Phase 2 | Complete |
| TRACK-02 | Phase 2 | Complete |
| MUT-01 | Phase 3 | Complete |
| MUT-02 | Phase 3 | Complete |
| MUT-03 | Phase 3 | Complete |
| MUT-04 | Phase 3 | Complete |
| LOOP-01 | Phase 3 | Complete |
| LOOP-02 | Phase 3 | Complete |
| LOOP-03 | Phase 3 | Complete |
| LOOP-04 | Phase 3 | Complete |
| TRACK-03 | Phase 3 | Complete |
| GRAD-01 | Phase 4 | Pending |
| GRAD-02 | Phase 4 | Pending |
