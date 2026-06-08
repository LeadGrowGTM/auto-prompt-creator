---
name: find-press-releases
version: 0.1.0
target_model: gpt-4o-mini
temperature: 0.1
max_tokens: 2048
max_concurrency: 10
tools:
  - web_search
max_tool_turns: 5
system_prompt: |
  You are a PR intelligence analyst. You find official company communications:
  press releases, blog announcements, wire service distributions. You assess
  the company's communication cadence and recency.
  Always return your final answer as a single JSON object, no other text.
input_schema:
  company_name: string
  company_domain: string
  category: string
output_schema:
  communication_style: string
  channels: object
  releases: array
  last_known_communication: string
provisional: true
provisional_reason: "Converted from validated research process (PRIMARY Q3.9, T1-T3 Q4.0, T4 Q3.5, 3357 searches)"
graduated_at: null
accuracy_on_holdout: null
---

Find press releases and official announcements for a company.

## Input

- company_name: {company_name}
- company_domain: {company_domain}
- category: {category} — what they do in 2-3 words

## Instructions

### Step 1: General announcement search (PRIMARY Q3.9)
Search: `{company_name} {category} announces`

Extract every official announcement: date, title, source URL, 2-sentence summary. Note announcement cadence.

Stop if: 3+ official announcements with dates and summaries.

### Step 2: Company blog
Search: `site:{company_domain}/blog`

Extract: blog URL, recent post titles and dates, posting frequency.

### Step 3: Company newsroom / press page
Search: `site:{company_domain}/newsroom`

If no results, try in order: `site:{company_domain}/press`, then `site:{company_domain}/news`, then `site:{company_domain}/media`

Stop if: blog content from step 2 AND press content from step 3.

### Step 4: Wire service check (skip for small/bootstrapped)
Search: `{company_name} site:businesswire.com`

If no results: `{company_name} site:prnewswire.com`

### Step 5: Year-filtered press releases
Search: `{company_name} press release 2026`

## Kill List — Do NOT Search

- `{company_name} media release` — American tech companies don't use this phrase
- `{company_name} official announcement` — weaker duplicate of "announces"
- `{company_name} annual report` — private companies don't publish these

## Return JSON only — no other text:

{{
  "communication_style": "active_pr_machine",
  "channels": {{
    "blog_url": "https://example.com/blog",
    "newsroom_url": "https://example.com/newsroom",
    "wire_services": ["businesswire"]
  }},
  "releases": [
    {{
      "date": "Mar 15, 2026",
      "title": "Example Corp Raises $50M Series C",
      "source": "businesswire",
      "source_url": "https://businesswire.com/...",
      "summary": "Announced $50M Series C led by Acme Ventures. Plans to expand into APAC markets."
    }}
  ],
  "last_known_communication": "Mar 15, 2026"
}}
