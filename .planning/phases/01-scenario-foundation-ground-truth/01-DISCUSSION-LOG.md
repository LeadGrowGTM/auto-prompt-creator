# Phase 1: Scenario Foundation + Ground Truth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 01-scenario-foundation-ground-truth
**Areas discussed:** Scenario file format, Ground truth generation flow, Train/validation split strategy, Human review checkpoint
**Mode:** --auto (all recommended defaults selected)

---

## Scenario File Format

| Option | Description | Selected |
|--------|-------------|----------|
| JSON | Parseable by humans and LLMs, matches RPB pattern | ✓ |
| YAML | More human-readable but less reliable LLM parsing | |
| Markdown with frontmatter | Familiar but harder to validate structure | |

**User's choice:** JSON (auto-selected recommended default)
**Notes:** Aligns with research-process-builder's ground-truth/schema.json pattern

---

## Ground Truth Generation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Batch with review | Generate all at once, review as a set for consistency | ✓ |
| Interactive per-input | Generate and approve one at a time | |
| Fully automated | Generate without human review | |

**User's choice:** Batch with review (auto-selected recommended default)
**Notes:** Batch generation allows consistency checking across outputs before approval

---

## Train/Validation Split Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 60/40 default, configurable | Research consensus for small datasets | ✓ |
| 50/50 fixed | Simple but less training data | |
| 80/20 (ML standard) | Too little validation for 5-10 examples | |

**User's choice:** 60/40 default, configurable (auto-selected recommended default)
**Notes:** DSPy recommends 20/80 for prompt optimization but our tiny datasets need more balance

---

## Human Review Checkpoint

| Option | Description | Selected |
|--------|-------------|----------|
| Inline during generation | Review each output as generated | ✓ |
| Separate approval step | Generate all, then review batch | |
| Skip review | Trust Opus output directly | |

**User's choice:** Inline during generation (auto-selected recommended default)
**Notes:** Combined with batch generation — generate all, then review inline

---

## Claude's Discretion

- Exact JSON schema field names and nesting
- Directory naming conventions
- Edge case handling in ground truth generation
- README.md template per scenario

## Deferred Ideas

None
