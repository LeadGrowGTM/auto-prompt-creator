---
paths:
  - "scenarios/**/evals/**"
  - "scenarios/**/ground-truth/**"
  - "scenarios/**/prompts/**"
---

# Eval Safety

Rules that protect the integrity of the anneal loop. Violations produce prompts that overfit and fail in production.

## Holdout isolation

Never read, reference, or score against holdout-split ground truth files during the optimization loop. Holdout is scored exactly once at graduation. If you need more signal, add inputs to the train or val splits instead.

## Halt conditions are authoritative

Check `loop-state.json` before every iteration. If `halt_reason` is not null, the loop is done. Do not mutate further, do not reset the halt, do not create a new version. Report the final state.

## Mutation diversity

Log the mutation type in `loop-state.json` every iteration. Before selecting the next mutation, read the log and enforce the phase constraints from METHODOLOGY.md:
- Iterations 1-3 (bootstrap): all types allowed.
- Iterations 4-7 (generalize): examples are blocked. Structural mutations only.
- Iterations 8-10 (polish): subtractive encouraged. Mandatory subtractive check at iteration 8.
- Never run two consecutive example-heavy mutations.
- Max 4 worked examples per concept.

## No version-specific eval scripts

Use the parameterized `run-eval.mjs --version vNNN`. Do not create `run-v001.mjs`, `run-v002.mjs`, etc. Version-specific scripts are tech debt per METHODOLOGY.md.

## Score before mutate

Every prompt version must be scored before the next version is created. Do not generate v(N+1) without a scored `v(N).json` in `evals/`. Raw outputs alone are not sufficient -- they must pass through `judge.mjs`.
