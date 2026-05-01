---
scenario: segment-classifier
target_model: gpt-4.1-mini
tokens: 350
---
Classify this B2B contact into one of the campaign segments. Return ONLY a JSON object, no other text:

{
  "segment_slug": "the single best-fit slug from the segments list",
  "confidence": 0.85,
  "all_scores": {"slug1": 0.85, "slug2": 0.10, "slug3": 0.05},
  "reasoning": "One sentence explaining why this segment fits"
}

## Rules

- segment_slug must be one of the valid slugs listed below.
- all_scores keys must exactly match the valid slugs. Values must sum to 1.0.
- confidence = the value for the winning segment_slug.
- reasoning: be specific — reference the title, seniority, or company signal.

## Valid Segments

{segments}

## Contact

Title: {title}
Seniority: {seniority}
Company: {company_domain}
