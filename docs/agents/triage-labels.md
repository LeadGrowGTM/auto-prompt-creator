# Triage Labels

Five canonical states for all issues in this repo.

| Label | When to Apply | Who Acts Next | Example |
|-------|--------------|---------------|---------|
| `needs-triage` | New issue just opened, no one has reviewed it yet | Maintainer reads and re-labels | "setup.mjs crashes on Windows" |
| `needs-info` | Issue is missing reproduction steps, version, or scenario name | Reporter provides missing details | "It doesn't work" — needs: exact command run, error output, scenario name |
| `ready-for-agent` | Issue is scoped, reproducible, and confined to `setup.mjs` or eval template generation | Agent picks up and fixes | "icp-loop mode does not write `icp-loop.mjs` when `--mode icp-loop` is passed on Windows" |
| `ready-for-human` | Needs judgment on methodology tradeoffs, API credentials, or cross-repo impact | Maintainer resolves | "Should the generalize phase block all example mutations or only back-to-back ones?" |
| `wontfix` | Intentionally out of scope — e.g. GUI, dependency injection, runtime other than Bun | No action needed | "Add support for Node.js runtime" |

## Label Decision Tree

1. Is the issue reproducible with a concrete command? No → `needs-info`. Yes → continue.
2. Is the fix confined to `setup.mjs` scaffold logic or generated eval template code? Yes → `ready-for-agent`. No → continue.
3. Does the fix require methodology judgment or external system access? Yes → `ready-for-human`.
4. Is the behavior intentional per METHODOLOGY.md or CLAUDE.md? Yes → `wontfix`.

## Agent Scope for `ready-for-agent`

An agent working a `ready-for-agent` issue is authorized to:
- Edit `setup.mjs` only
- Run `bun setup.test.mjs` to verify
- Write a new test case in `setup.test.mjs` that covers the regression

An agent must NOT:
- Modify scenario files under `scenarios/`
- Touch `library/` or `METHODOLOGY.md`
- Add npm/bun dependencies
