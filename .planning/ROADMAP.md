# Roadmap: Auto Prompt Creator

## Overview

Four phases following a strict dependency chain: define scenarios and generate ground truth, build the execution and evaluation engine, wire up the mutation loop, then graduate winning prompts. Each phase produces testable file artifacts. The entire system is a SKILL.md methodology + structured file conventions running inside Claude Code sessions.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Scenario Foundation + Ground Truth** - Define the scenario file format, input structure, and Opus-generated ground truth with human review
- [ ] **Phase 2: Execution + Evaluation** - Run candidate prompts against Haiku and score outputs against ground truth with a reliable judge
- [ ] **Phase 3: Mutation + Optimization Loop** - Analyze failures, mutate prompts, enforce convergence rules, and run the full anneal loop
- [ ] **Phase 4: Graduation + Library** - Graduate winning prompts to a portable library with metadata and lineage

## Phase Details

### Phase 1: Scenario Foundation + Ground Truth
**Goal**: User can define a complete scenario and have high-quality ground truth ready for optimization
**Depends on**: Nothing (first phase)
**Requirements**: SCEN-01, SCEN-02, SCEN-03, GT-01, GT-02, GT-03, GT-04, GT-05
**Success Criteria** (what must be TRUE):
  1. User can create a scenario directory with scenario.json (task description, schema, rubric, config) and the system validates the structure
  2. User can provide 5-10 source input files and Opus generates gold-standard outputs for each one
  3. User can review ground truth before optimization begins and approve/reject individual outputs
  4. Ground truth consistency check flags disagreements when Opus generates different outputs for the same input on two runs
  5. Inputs are automatically split into train/validation sets with configurable ratio
**Plans:** 2 plans
Plans:
- [ ] 01-01-PLAN.md -- Create scenario directory structure, scenario.json schema, and 9 company input files
- [ ] 01-02-PLAN.md -- Generate Opus ground truth with consistency check, human review, and train/validation split

### Phase 2: Execution + Evaluation
**Goal**: User can run a candidate prompt against Haiku and get reliable, structured scoring against ground truth
**Depends on**: Phase 1
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EVAL-01, EVAL-02, EVAL-03, EVAL-04, TRACK-01, TRACK-02
**Success Criteria** (what must be TRUE):
  1. User can execute a candidate prompt against Haiku via CC agent spawning and get structured output back
  2. Parse failures are logged and scored as 0 without crashing the session
  3. Opus judges Haiku output against ground truth using multi-dimension rubric with per-input and per-dimension scores
  4. Multi-run voting (3 judge runs, median) produces stable scores for the same prompt
  5. Each prompt version is stored as an immutable file (prompts/v001.md) and mutations are logged in append-only mutations.log
**Plans**: TBD

### Phase 3: Mutation + Optimization Loop
**Goal**: The system iteratively improves prompts through failure-driven mutation until accuracy threshold is met or convergence is detected
**Depends on**: Phase 2
**Requirements**: MUT-01, MUT-02, MUT-03, MUT-04, LOOP-01, LOOP-02, LOOP-03, LOOP-04, TRACK-03
**Success Criteria** (what must be TRUE):
  1. Failure analysis identifies named patterns (e.g., "formal-language-regression", "missing-field") and generates targeted prompt mutations
  2. The anneal loop runs autonomously, halting when accuracy >= 92%, max iterations reached, or convergence plateaus for 3 consecutive iterations
  3. Train vs validation accuracy are tracked separately and the loop halts if the gap exceeds 8% (overfitting signal)
  4. Prompt length stays under token budget (default 800) with consolidation passes when approaching the limit
  5. All iterations are git-committed for diffable prompt lineage
**Plans**: TBD

### Phase 4: Graduation + Library
**Goal**: Winning prompts are packaged as portable, reusable files with full metadata
**Depends on**: Phase 3
**Requirements**: GRAD-01, GRAD-02
**Success Criteria** (what must be TRUE):
  1. Prompts hitting the accuracy threshold are automatically copied to library/ as named, portable files
  2. Each graduated prompt includes metadata: scenario name, final accuracy, iterations needed, test set size, date
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scenario Foundation + Ground Truth | 0/2 | Planning | - |
| 2. Execution + Evaluation | 0/TBD | Not started | - |
| 3. Mutation + Optimization Loop | 0/TBD | Not started | - |
| 4. Graduation + Library | 0/TBD | Not started | - |
