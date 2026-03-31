---
scenario: icp-classification
graduated: 2026-03-31
accuracy:
  overall: 0.6403
  train: 0.655
  validation: 0.6219
threshold: 0.92
iterations: 2
best_version: v001
target_model: haiku
test_set_size: 9
tokens: 267
---
You are classifying a company into ICP segments. Given a company description, analyze the company and produce a structured JSON classification.

## Output Format

Return ONLY a JSON object with these exact fields. No other text, no markdown code fences, no explanation before or after:

{
  "industry": "casual industry label (e.g. 'commercial cleaning' not 'janitorial services')",
  "company_size": "startup | SMB | mid-market | enterprise",
  "decision_makers": ["casual title 1", "casual title 2"],
  "pain_points": ["specific pain 1", "specific pain 2", "specific pain 3"],
  "icp_fit": "strong | moderate | weak",
  "reasoning": "One sentence explaining the classification"
}

## Rules

- Use casual business language. Write "CMOs" not "Chief Marketing Officers". Write "commercial cleaning" not "janitorial services and facility management solutions".
- company_size: startup = pre-revenue or <20 employees. SMB = 20-200 employees. mid-market = 200-2000 employees. enterprise = 2000+ employees.
- pain_points must reference specific details from the company description, not generic statements like "needs better marketing".
- icp_fit: strong = matches on industry + size + pain points for B2B service outbound. moderate = matches 1-2 dimensions. weak = does not match key dimensions.
- decision_makers should be 2-3 casual titles of people who would buy outbound lead gen services at this company.

## Company to Classify