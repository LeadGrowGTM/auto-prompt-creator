# Auto Prompt Creator

## What This Is

A prompt optimization system that runs inside Claude Code sessions. Takes source inputs + desired output structure, uses Opus to generate ground truth, then iteratively refines a prompt for Haiku until it achieves 92%+ accuracy against that ground truth. Similar architecture to the research-process-builder's anneal loop but optimizing LLM prompts instead of search patterns.

## Core Value

A prompt produced by this system makes a cheap model (Haiku) produce outputs indistinguishable from a powerful model (Opus) for a specific, defined task.

## Requirements

### Validated

- [x] Define scenarios as structured files (input data, desired output schema, quality rubric) — Validated in Phase 1
- [x] Generate ground truth from Opus within Claude Code session — Validated in Phase 1
- [x] Run candidate prompts against Haiku via Claude Code agent spawning — Validated in Phase 2
- [x] Score Haiku output vs ground truth using LLM judge (Opus-as-judge within CC) — Validated in Phase 2
- [x] Track prompt iterations with scores, failure patterns, and mutations applied — Validated in Phase 2
- [x] Dynamic schema per scenario — fields are part of what the prompt defines, not hardcoded — Validated in Phase 1

### Active


- [ ] Prompt mutation engine: analyze failures, generate targeted prompt improvements
- [ ] Anneal loop: iterate until 92%+ accuracy or max iterations
- [ ] Version control prompt iterations (git-tracked, diffable)
- [ ] Output format uses normalized casual language (LeadGrow-native labels)

### Out of Scope

- External API calls — everything runs inside Claude Code sessions, no separate Anthropic API billing
- Python runtime / CLI scripts — this is a methodology + file format, CC is the engine
- autocontext dependency — standalone, inspired by but not coupled to autocontext patterns
- Web UI or dashboard — file-based, git-tracked

## Context

- **Pattern source: research-process-builder** — 16 validated processes, anneal loop with ground truth evaluation, iterative scoring. Same architecture but for prompts instead of search patterns.
- **Pattern source: autocontext** — AgentTaskSpec (task_prompt, judge_rubric, calibration_examples, quality_threshold), LLMJudge (multi-sample eval, dimension scoring), ImprovementLoop (evaluate→revise→re-evaluate). We borrow the concepts but run everything inside CC.
- **First use case: ICP classification** — Given company descriptions, define the ICP. Output uses normalized casual labels: "CMOs" not "Chief Marketing Officers", "mid-market" not "200-500 employees", "commercial cleaning" not "janitorial services and facility management".
- **Runtime model**: Opus (current CC session) generates ground truth and judges. Haiku (spawned as agent) runs candidate prompts. No external API calls.

## Constraints

- **Runtime**: Claude Code sessions only — no separate API keys, no external services
- **Target model**: Haiku 4.5 as the "stupid model" to optimize for
- **Accuracy threshold**: 92%+ before a prompt is considered "done"
- **Language style**: All outputs in normalized casual business language, not corporate/formal

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Standalone CLI over autocontext scenario | autocontext optimizes single outputs; we optimize prompts across N inputs — different loop shape | — Pending |
| LLM judge over deterministic scoring | Handles semantic equivalence ("CMOs" = "marketing leadership"), more flexible than field matching | — Pending |
| Claude Code as runtime | Zero external API cost, Opus+Haiku both available via agent spawning | — Pending |
| Dynamic schema per scenario | ICP fields aren't static — the prompt itself defines what fields to extract | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-31 after Phase 2 completion — execution engine + evaluation framework validated*
