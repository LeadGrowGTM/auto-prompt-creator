---
description: Holdout never touched during loop. Check loop-state.json before mutating. Read METHODOLOGY.md before loop.
globs: ["scenarios/**"]
---

# Anneal Loop Discipline

- **Holdout is sacred.** Only train + val used during optimization. Holdout scores only at graduation.
- **Check `loop-state.json` before each iteration.** If `halt_reason` is not null, stop.
- **Read METHODOLOGY.md before running any loop.** Mutation diversity rules prevent overfitting.
- **Mutation diversity required:** additive, structural, targeted, consolidation, subtractive — track in loop-state.
- **Runtime is Bun.** Use `bun`, not `node`.
