---
name: find-hiring
version: 0.1.0
target_model: gpt-4o-mini
temperature: 0.1
max_tokens: 2048
max_concurrency: 10
tools:
  - web_search
  - scrape_url
max_tool_turns: 5
system_prompt: |
  You are a hiring intelligence analyst. You surface who a company is currently hiring
  for — roles, departments, seniority levels, and hiring velocity. Hiring patterns
  reveal company priorities and growth trajectory.
  Always return your final answer as a single JSON object, no other text.
input_schema:
  company_name: string
  company_domain: string
  category: string
output_schema:
  hiring_status: string
  open_roles_count: number
  careers_url: string
  ats_platform: string
  top_departments: array
  seniority_breakdown: string
  hiring_signals: string
provisional: true
provisional_reason: "Converted from validated research process (PRIMARY Q4.0 all tiers, 3357 searches)"
graduated_at: null
accuracy_on_holdout: null
---

Find current hiring activity, open roles, and growth signals for a company.

## Input

- company_name: {company_name}
- company_domain: {company_domain}
- category: {category} — what they do in 2-3 words

## Instructions

### Step 1: General careers search (PRIMARY Q4.0)
Search: `{company_name} {category} careers`

Extract: careers page URL, every open role with title and department, which job boards have listings (Indeed, Glassdoor, LinkedIn, Built In, Wellfound), total open positions, hiring signals.

Stop if: careers page with 10+ roles and can identify top hiring departments.

### Step 2: ATS board search
Search: `{company_name} site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com OR site:wellfound.com`

Extract: ATS platform used, ATS board URL, every role title, group by department. Wellfound especially useful for startups without traditional ATS.

Stop if: clear picture of departments hiring and seniority levels.

### Step 3: Careers page direct check
Search: `site:{company_domain}/careers`

If no results: `site:{company_domain} careers OR jobs OR "open positions"`

### Step 4: Year-filtered hiring activity (skip for <20 employees)
Search: `{company_name} hiring 2026`

Extract: recent hiring announcements, new roles, velocity signals ("hiring 50 engineers", "doubling the team").

### Step 5: Fallback for obscure companies (only if steps 1-2 returned nothing)
Search: `{company_name} "we're hiring" OR "join our team" OR "open positions"`

"No active hiring detected" is a valid signal — company may be early stage, bootstrapped, or not growing.

## Kill List — Do NOT Search

- `{company_name} jobs site:linkedin.com` — returns location-based noise for ambiguous names
- `{company_name} glassdoor salary` — salary estimates, not hiring activity
- `{company_name} internships` — too narrow
- `{company_name} remote jobs` — aggregator noise

## Return JSON only — no other text:

{{
  "hiring_status": "actively_hiring",
  "open_roles_count": 23,
  "careers_url": "https://example.com/careers",
  "ats_platform": "greenhouse",
  "top_departments": [
    {{
      "department": "Engineering",
      "role_count": 12,
      "example_titles": ["Senior Software Engineer", "Staff Engineer", "Engineering Manager"]
    }},
    {{
      "department": "Sales",
      "role_count": 6,
      "example_titles": ["Account Executive", "SDR", "VP of Sales"]
    }}
  ],
  "seniority_breakdown": "mostly_senior",
  "hiring_signals": "Scaling engineering aggressively — 12 of 23 roles are engineering. 4 senior+ roles suggest building out platform team. Sales hiring suggests GTM expansion.",
  "sources": ["https://boards.greenhouse.io/example", "https://example.com/careers"]
}}
