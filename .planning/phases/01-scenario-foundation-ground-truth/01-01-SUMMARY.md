---
phase: 01-scenario-foundation-ground-truth
plan: 01
subsystem: scenario-definition
tags: [scenario, schema, input-files, icp-classification]
dependency_graph:
  requires: []
  provides: [scenario-directory, scenario-json, input-files]
  affects: [ground-truth-generation, execution-engine]
tech_stack:
  added: [json-scenario-format]
  patterns: [self-contained-directory, dynamic-output-schema, weighted-rubric]
key_files:
  created:
    - scenarios/icp-classification/scenario.json
    - scenarios/icp-classification/inputs/dbs-building-solutions.json
    - scenarios/icp-classification/inputs/trx-services.json
    - scenarios/icp-classification/inputs/osp.json
    - scenarios/icp-classification/inputs/bartos-industries.json
    - scenarios/icp-classification/inputs/roush-cleantech.json
    - scenarios/icp-classification/inputs/wisconsin-plastics.json
    - scenarios/icp-classification/inputs/abacus-ai.json
    - scenarios/icp-classification/inputs/dealer-teamwork.json
    - scenarios/icp-classification/inputs/title-one.json
    - scenarios/icp-classification/README.md
  modified: []
decisions:
  - Rubric dimension named "label_normalization" (weight 0.25) instead of generic "style" to be more specific about what it scores
  - .gitkeep files added to empty subdirectories (ground-truth/, prompts/, evals/, library/) so git tracks the directory structure
metrics:
  duration: 2m
  completed: "2026-03-31T17:03:23Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 16
---

# Phase 01 Plan 01: Scenario Directory and Input Files Summary

ICP classification scenario with full schema definition (6 output fields, 4-dimension weighted rubric, label definitions) and 9 diverse company inputs spanning 7 industries and 4 size tiers.

## What Was Done

### Task 1: Create scenario.json with full schema definition
Created the complete scenario directory structure (`scenarios/icp-classification/`) with 5 subdirectories and the `scenario.json` file containing all required sections per locked decisions D-01 through D-04, D-09, D-10, D-14:

- **config**: haiku target model, 0.92 accuracy threshold, 15 max iterations, 800 token budget, 60/40 train/validation split with deterministic seed
- **input_schema**: company_name (required), company_description (required), website_url (optional)
- **output_schema**: 6 dynamic fields (industry, company_size, decision_makers, pain_points, icp_fit, reasoning) with allowed_values where appropriate
- **rubric**: 4 weighted dimensions -- accuracy (0.4), label_normalization (0.25), completeness (0.2), specificity (0.15)
- **label_definitions**: canonical definitions for company_size (startup/SMB/mid-market/enterprise with employee thresholds) and icp_fit (strong/moderate/weak with matching criteria)

### Task 2: Create 9 company input files and README
Created 9 input files with deliberate diversity across industries, company sizes, and expected ICP fit:

| Company | Industry | Size | Expected Fit |
|---------|----------|------|-------------|
| DBS Building Solutions | Commercial cleaning | mid-market (340 emp) | Strong |
| TRX Services | Field services / HVAC | SMB (180 emp) | Strong |
| OSP | Office services | SMB (95 emp) | Moderate |
| Bartos Industries | Metal fabrication / manufacturing | mid-market (420 emp) | Strong |
| ROUSH CleanTech | Clean energy / alt fuel vehicles | enterprise (2800+ emp) | Moderate |
| Wisconsin Plastics | Plastics manufacturing | mid-market (310 emp) | Moderate |
| Abacus AI | AI/ML platform (SaaS) | SMB (85 emp) | Weak |
| Dealer Teamwork | Automotive marketing (SaaS) | SMB (45 emp) | Weak |
| Title One | Education services | startup (15 emp) | Weak |

README.md documents scenario status as "defining" with input count and placeholder fields for accuracy tracking.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added .gitkeep files to empty subdirectories**
- **Found during:** Task 1
- **Issue:** Git does not track empty directories. The 4 placeholder subdirectories (ground-truth/, prompts/, evals/, library/) would not appear in the repo.
- **Fix:** Created .gitkeep files in each empty subdirectory
- **Files modified:** scenarios/icp-classification/{ground-truth,prompts,evals,library}/.gitkeep
- **Commit:** 20da348

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 20da348 | feat(01-01): create scenario.json with full ICP classification schema |
| 2 | ba752d5 | feat(01-01): add 9 company input files and scenario README |

## Known Stubs

None. All files contain complete, substantive data.

## Self-Check: PASSED

All 11 created files verified on disk. Both commit hashes (20da348, ba752d5) confirmed in git log.
