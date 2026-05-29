---
target_model: gpt-4.1-mini
temperature: 0.1
max_tokens: 512
max_concurrency: 15
tools:
  - scrape_url
max_tool_turns: 2
system_prompt: |
  You are a B2B company researcher. You scrape company homepages to classify
  what the company does and who buys from them. Return ONLY a JSON object, no other text.
---
Scrape this company's homepage and classify what they do.

Website: https://{domain}
Company: {company_name}

## Instructions

Use scrape_url to fetch the homepage at https://{domain}.

From the content, extract:

1. **what_they_do** — 1 sentence describing their product/service (e.g. "B2B SaaS for expense management", "API infrastructure for payments", "HR software for mid-market companies")

2. **industry_label** — short industry label (e.g. "fintech", "hr tech", "devtools", "marketing tech", "healthtech", "edtech", "logistics tech", "cybersecurity", "sales intelligence")

3. **b2b_flag** — true if they sell to businesses (B2B), false if consumer-focused (B2C)

4. **employees_estimate** — "startup" (<20), "small" (20-100), "mid" (100-500), "large" (500+) — use page signals (team page, hiring, org structure)

5. **scrape_failed** — true if the page failed to load, is parked, or has no meaningful content

## Rules
- If scrape_url fails or page is parked, return scrape_failed: true and null other fields
- Homepage only — do not follow links to subpages
- If no homepage exists (domain not found), set scrape_failed: true
- Focus on what they SELL, not their marketing copy

## Return JSON only — no other text:

{
  "what_they_do": "one sentence",
  "industry_label": "short label",
  "b2b_flag": true,
  "employees_estimate": "startup | small | mid | large",
  "scrape_failed": false
}
