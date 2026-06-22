# Issue Tracker

## Remote

This repo is hosted on GitHub at:
**https://github.com/LeadGrowGTM/auto-prompt-creator**

Issues are tracked at:
**https://github.com/LeadGrowGTM/auto-prompt-creator/issues**

## What belongs in issues

- Bug reports against `setup.mjs` scaffold output (wrong file structure, bad defaults)
- Incorrect halt-condition logic in `loop-state.json` state machine
- Eval runner failures (`run-eval.mjs`, `judge.mjs`)
- Methodology violations caught post-hoc (overfitting, skipped holdout isolation)
- Requests to add new scenario modes beyond `standard` and `icp-loop`
- Documentation gaps in README.md or METHODOLOGY.md

## What does NOT belong in issues

- Per-scenario tuning decisions (rubric weights, prompt mutations) — those live inside `scenarios/[name]/`
- Graduated prompt quality debates — those are `library/` discussions
- API key / environment problems — those are local config issues, not code defects

## Agent-actionable issues

For issues tagged `ready-for-agent` (see triage-labels.md), the agent should:
1. Read `CLAUDE.md` for repo constraints
2. Check `METHODOLOGY.md` for the relevant rule
3. Apply surgical fix to `setup.mjs` only — no other files unless the issue explicitly names them
4. Verify with `bun setup.test.mjs` before marking done
