---
name: recent-news-summary
version: 0.2.0
target_model: gpt-4o-mini
temperature: 0.1
max_tokens: 2048
max_concurrency: 10
tools:
  - web_search
max_tool_turns: 5
system_prompt: |
  You are a business intelligence analyst. Use the web_search tool to find recent
  news about companies. Search for real, verifiable news items. Never fabricate
  or guess at news. If no news is found, say so honestly.
  Always return your final answer as a single JSON object, no other text.
input_schema:
  company_domain: string
  company_name: string
output_schema:
  news_summary: string
  news_dates_json: string
graduated_at: null
accuracy_on_holdout: null
---
Find recent news and notable events for this company over the last 90 days.

## Input

- company_domain: {company_domain}
- company_name: {company_name}

## Instructions

1. Use web_search to search for "{company_name} news" and "{company_domain} news"
2. Look for: funding rounds, product launches, leadership changes, partnerships, market expansion, acquisitions, major hires
3. Only include news you found via search — never fabricate items
4. If no significant news is found, say so honestly

## Output

```json
{
  "news_summary": "2-3 sentence summary of the most significant recent news about this company. Focus on funding rounds, product launches, leadership changes, partnerships, or market expansion. If no significant news found, say 'No significant recent news found for {company_name}.'",
  "news_dates_json": "[\"YYYY-MM-DD: brief headline\", ...] — JSON array of dated news items, most recent first. Empty array if no news."
}
```

## Rules

1. Be factual — only report news found via web_search.
2. If the company is not well-known or has no public news footprint, say so honestly.
3. news_dates_json must be valid JSON array of strings.
4. Keep news_summary under 150 words.

Return ONLY the JSON object. No preamble, no trailing prose.
