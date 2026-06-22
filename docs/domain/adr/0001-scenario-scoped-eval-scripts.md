# ADR-0001: Scenario-Scoped Generated Eval Scripts

## Status
Accepted

## Context

Each scenario needs an eval runner (`run-eval.mjs`) and a scorer (`judge.mjs`) that know:
- Where to find the prompt versions for that scenario
- Which model to call (configurable per scenario, not global)
- How to format user messages for that scenario's input schema

Two approaches were considered:

**Option A — Shared parameterized scripts at repo root.** A single `run-eval.mjs` at root accepts `--scenario [name]` and `--version vNNN`. All scenarios share one runner.

**Option B — Generated per-scenario scripts.** `setup.mjs` generates a customized `run-eval.mjs` and `judge.mjs` inside `scenarios/[name]/evals/`. Each script has the scenario path hardcoded in template literals and a `[TODO]` marker where the caller customizes the user message format.

The repo chose **Option B**.

## Decision

`setup.mjs` generates scenario-scoped `run-eval.mjs` and `judge.mjs` scripts as template strings. Each script:
- Resolves its own base path via `import.meta.dir` relative to its location inside the scenario
- Reads `scenario.json` from the same scenario directory to get the target model
- Exposes a `[TODO]` comment at the user-message construction point so the developer can customize the input serialization per scenario without touching shared code

The `METHODOLOGY.md` doc prohibits creating version-specific scripts (e.g. `run-v001.mjs`) and requires parameterized `--version vNNN` usage instead.

## Consequences

**Good:**
- Each scenario is fully self-contained — it can be zipped up and shared without the rest of the repo
- The `[TODO]` hook makes per-scenario input customization explicit and localized
- No shared state between scenarios; one scenario's malformed eval cannot affect another's
- `import.meta.dir` path resolution works correctly regardless of where `bun` is invoked from

**Bad:**
- Duplication: every scenario has its own copy of the eval runner logic. A bug fix in the template requires re-generating or manually patching all existing scenario scripts
- The generated scripts have no test coverage of their own — only `setup.mjs` (the generator) is tested via `setup.test.mjs`
- Developers must remember to run `bun scenarios/[name]/evals/run-eval.mjs`, not a root-level command
- The `run-v001.mjs` / `run-vNNN.mjs` files found in `scenarios/icp-classification/evals/` show that the version-specific anti-pattern was violated at least once before the rule was codified in METHODOLOGY.md

## Related

- `METHODOLOGY.md` section "Parameterization" — codifies the no-version-specific-scripts rule
- `.claude/rules/eval-safety.md` — enforces the rule for agents
- `setup.test.mjs` — tests the generator, not the generated scripts
