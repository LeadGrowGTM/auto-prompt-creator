# rendered-semantic-qa

Per-row QA of rendered outbound email copy before it ships to Bison.

## Purpose

After Stage 7 copy generation, Stage 8a samples N rows per segment, resolves `{{DOUBLE_BRACE}}` variables against real lead data, and runs this prompt on each rendered row. Findings with `severity: high` block the pipeline via `CheckpointPending`; the operator edits `winner.yaml` and re-runs.

## Input / Output

- **Input:** `{subject, body, persona_context: {resolved, missing}, edp_register}`
- **Output:** `{pass: bool, findings: [{severity, category, message, excerpt}]}`

## Rubric (7 dimensions)

| Dimension | Weight | Blocks? |
|---|---:|---|
| null_variable_collapse | 0.25 | HIGH always |
| pronoun_title_tense_match | 0.15 | MEDIUM |
| ai_slop_formula_detection | 0.20 | HIGH always |
| edp_register_fit | 0.15 | HIGH on hard miss |
| grammatical_coherence | 0.10 | LOW |
| em_dash_free | 0.05 | HIGH if body em-dash |
| spam_trigger_phrases | 0.10 | HIGH |

## Graduation Status

**Provisional (v0.1.0, 2026-04-19).** Ships with 15 hand-authored synthetic examples covering all 7 rubric dimensions. No formal anneal loop run — graduation deferred until real dogfood rendered rows accumulate post-ship. Phase 3.5 will replace synthetic examples with real campaign data and run the full anneal-to-0.92-holdout loop.

## Re-running the Anneal Loop (Future)

```bash
cd ../auto-prompt-creator
bun evals/run-eval.mjs rendered-semantic-qa v001
bun evals/judge.mjs rendered-semantic-qa v001 --auto
# Mutate based on failures, bump to v002, repeat to 0.92+ holdout accuracy.
```

## Consumers

- `gtm-orchestrator` Stage 8a (`src/gtm_orchestrator/stages/qa_semantic.py`) via `RunConfig(prompt=RENDERED_SEMANTIC_QA_PROMPT, library_path=LIBRARY_PATH)`.
- Constants exported from `gtm_orchestrator.adapters.runtime_prompts`.
