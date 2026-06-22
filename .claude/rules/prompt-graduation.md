---
description: Graduation criteria — holdout scoring required, generalization metrics, library format
globs: ["library/**", "scenarios/*/prompts/**"]
---

# Prompt Graduation

A prompt graduates to `library/{scenario}.md` when:
- 92%+ accuracy on val split
- Holdout score within 5% of val score (generalization check)
- YAML frontmatter metadata (target model, dimensions, scores, date)

Library graduates are the canonical prompts used downstream. Source scenario retains full history.
