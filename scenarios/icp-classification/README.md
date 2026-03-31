# ICP Classification Scenario

Optimizes a prompt that classifies companies into ICP segments (industry, size, decision makers, pain points, fit level) from short company descriptions using casual, normalized business language.

## Status

- **Status:** evaluating
- **Inputs:** 9 (5 train / 4 validation)
- **Ground truth:** 9 files approved (3 strong, 3 moderate, 3 weak)
- **Current accuracy:** 64.0%
- **Best prompt version:** v001
- **Created:** 2026-03-30
- **Last modified:** 2026-03-31

## Scores

| Version | Train | Validation | Overall | Parse Failures |
|---------|-------|------------|---------|----------------|
| v001 | 0.655 | 0.622 | 0.640 | 0 |

## Dimension Breakdown (v001)

| Dimension | Weight | Score |
|-----------|--------|-------|
| Accuracy | 0.40 | 0.472 |
| Label Normalization | 0.25 | 0.611 |
| Completeness | 0.20 | 0.972 |
| Specificity | 0.15 | 0.694 |
