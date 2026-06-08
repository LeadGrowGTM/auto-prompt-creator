---
name: find-news
version: 0.1.0
target_model: gpt-4o-mini
temperature: 0.1
max_tokens: 2048
max_concurrency: 10
tools:
  - web_search
max_tool_turns: 7
system_prompt: |
  You are a business intelligence analyst. You find recent news and notable events
  about a company over the last 6-12 months. Never fabricate or guess at news dates.
  If no date appears in the snippet or article, use "date_unknown".
  Always return your final answer as a single JSON object, no other text.
input_schema:
  company_name: string
  company_domain: string
  category: string
output_schema:
  trajectory: string
  events: array
  event_types_found: array
provisional: true
provisional_reason: "Converted from validated research process (ENRICHMENT Q3.6, 3357 searches). T4 micro companies inherently thin — accept limitation."
graduated_at: null
accuracy_on_holdout: null
---

Find recent news and notable events for a company over the last 6-12 months.

## Input

- company_name: {company_name}
- company_domain: {company_domain}
- category: {category} — what they do in 2-3 words

## Instructions

### Step 1: General news sweep (ENRICHMENT Q3.6)
Search: `{company_name} {category} recent news`

Extract every distinct news event: exact date from snippet (NEVER fabricate — use "date_unknown" if not visible), event type, source URL, 2-sentence summary.

Stop if: 4+ distinct events covering multiple event types.

### Step 2: M&A and funding
Search: `{company_name} acquisition OR funding 2026`

Extract acquisitions (acquired or was acquired) and funding rounds (amount, lead investor, date, type).

### Step 3: Partnerships and integrations
Search: `{company_name} partnership OR integration`

Extract strategic alliances, integration announcements, channel partnerships.

### Step 4: Product and expansion
Search: `{company_name} launches OR "new feature" OR expansion 2026`

Extract product launches, feature releases, geographic expansion, new markets.

Stop if: solid mix of news across event types.

### Step 5: Leadership and strategic narrative
Search: `{company_name} CEO interview OR "new hire" OR leadership`

Extract CEO/founder quotes about direction, new C-suite hires or departures.

### Step 6: Tech press (only if VC-backed / well-known)
Search: `{company_name} site:techcrunch.com`

Skip if small or bootstrapped.

### Step 7: Activity signals (only if steps 1-5 returned almost nothing)
Search: `{company_name} hiring OR "linkedin posts" OR blog`

For obscure companies. "No news coverage found" is a valid signal.

## Kill List — Do NOT Search

- `site:businessinsider.com {company_name}` — zero results for startups
- `site:reuters.com {company_name}` — useless below unicorn tier
- `{company_name} breaking news` — identical to "news", wastes a search

## Return JSON only — no other text:

{{
  "trajectory": "growing",
  "events": [
    {{
      "date": "Mar 2, 2026",
      "event_type": "funding",
      "summary": "Raised $50M Series C led by Acme Ventures. Plans to expand European operations and double engineering team.",
      "source_url": "https://techcrunch.com/..."
    }}
  ],
  "event_types_found": ["funding", "partnership", "product_launch"],
  "last_known_activity_date": "Mar 2, 2026"
}}
