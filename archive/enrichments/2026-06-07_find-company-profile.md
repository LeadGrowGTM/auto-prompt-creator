---
name: find-company-profile
version: 0.1.0
target_model: gpt-4o-mini
temperature: 0.1
max_tokens: 2048
max_concurrency: 10
tools:
  - web_search
  - scrape_url
max_tool_turns: 6
system_prompt: |
  You are a company research analyst. You build a comprehensive company fact sheet
  from structured data platforms (ZoomInfo, Crunchbase, LinkedIn, RocketReach, etc.).
  This enrichment should run first — it feeds context to every other enrichment.
  Always return your final answer as a single JSON object, no other text.
input_schema:
  company_name: string
  company_domain: string
  category: string
output_schema:
  description: string
  industry: string
  founded_year: string
  hq_location: string
  employee_range: string
  funding_stage: string
  total_raised: string
  platforms_found: array
  company_tier: string
provisional: true
provisional_reason: "Converted from validated research process (ENRICHMENT Q3.8, strong T3-T4 Q3.8-4.0, 3357 searches)"
graduated_at: null
accuracy_on_holdout: null
---

Build a company fact sheet from structured data platforms.

## Input

- company_name: {company_name}
- company_domain: {company_domain}
- category: {category} — what they do in 2-3 words

## Instructions

### Step 1: Multi-platform sweep (ENRICHMENT Q3.8)
Search: `{company_name} {category} company overview`

Extract: what the company does, category/industry, employee count range, funding stage + total raised, HQ location, founded year. List every third-party platform with a profile (zoominfo, crunchbase, linkedin, rocketreach, pitchbook, tracxn, owler, cbinsights, g2) — include URL for each.

Count platforms: 5+ = T1 (well-known), 2-4 = T2 (some coverage), 0-1 = T3 (obscure).

Stop if: clear description, category, employee count, and funding info.

### Step 2: Crunchbase funding data
Search: `site:crunchbase.com {company_name}`

Extract: funding rounds (dates, amounts, lead investors), total raised, last round date and type.

Stop if: all core profile data complete.

### Step 3: ZoomInfo company intelligence
Search: `site:zoominfo.com {company_name}`

Extract: revenue estimate, employee count, industry classification.

### Step 4: LinkedIn profile
Search: `site:linkedin.com/company {company_name}`

Extract: employee count (often more current), about section, specialties.

### Step 5: RocketReach org chart
Search: `site:rocketreach.co {company_name}`

Note: domain is `rocketreach.co` (NOT .com). Extract: employee count, key people + titles, department breakdown.

### Step 6: Company website fallback (only if steps 1-5 returned thin results)
Search: `{company_name} official website about`

For obscure companies where major platforms have minimal data.

## Kill List — Do NOT Search

- `site:apollo.io {company_name}` — gated data, returns SEO blog posts
- `site:rocketreach.com {company_name}` — wrong domain, zero results. Use .co
- `{company_name} annual report` — useless for private companies
- `site:stackshare.io {company_name}` — only dev tools, not company intel

## Return JSON only — no other text:

{{
  "description": "AI-powered GTM data enrichment platform for revenue teams",
  "industry": "SaaS / Sales Technology",
  "founded_year": "2017",
  "hq_location": "New York, NY",
  "employee_range": "200-500",
  "funding_stage": "Series C",
  "total_raised": "$82M",
  "last_round": {{"type": "Series C", "amount": "$50M", "date": "Aug 2025"}},
  "platforms_found": [
    {{"platform": "crunchbase", "url": "https://crunchbase.com/organization/example"}},
    {{"platform": "zoominfo", "url": "https://zoominfo.com/c/example"}},
    {{"platform": "linkedin", "url": "https://linkedin.com/company/example"}},
    {{"platform": "g2", "url": "https://g2.com/products/example"}}
  ],
  "company_tier": "T2",
  "summary": "Mid-market SaaS company in growth phase. Series C with strong platform coverage. Active in GTM/sales tech space."
}}
