---
target_model: gpt-4.1-mini
temperature: 0.1
max_tokens: 2048
max_concurrency: 10
tools:
  - web_search
  - scrape_url
max_tool_turns: 7
system_prompt: |
  You are a local business research agent. You find websites and owner info
  for small businesses using web search and page scraping.
  Always return your final answer as a single JSON object, no other text.
---
Find the official website for a local business.

Business: {company_name}
Location: {city}, {state} {zip}

## Instructions

You have web_search and scrape_url tools. Use MINIMAL searches — return your JSON as soon as you have a confident answer.

### Step 1: BBB Search (preferred — gives website + owner)
Search: "{company_name}" {city} site:bbb.org

If no BBB result, try ONE variant with key words from the name (strip LLC/Inc/Corp, try common trade name variants like "Contractors" → "Builders").

If a BBB page is found:
- Scrape it with scrape_url
- Extract: website URL, owner/principal name, business address, phone
- Verify the BBB listing address matches {city}, {state}
- RETURN JSON IMMEDIATELY — do not keep searching if BBB gave you a website

### Step 2: Direct Search (only if BBB found no website)
Search: "{company_name}" {city} {state}

From results, pick the business website (not directory pages ABOUT the business):
- The business's OWN domain is the target, not Yelp/YP/Manta pages
- Domain contains company name words → strong signal
- Result mentions {city} or {state} → confirms identity

### Step 3: Give up quickly
If 2 searches return nothing useful, return null. Do NOT keep searching — "no website found" is valid.

## Rules
- Strip LLC, Inc, Corp, Ltd from the company name when searching
- "No website found" is a valid answer — return null with low confidence
- If multiple businesses share the name, use {city}/{state} to disambiguate
- If a candidate website is in a DIFFERENT city/state, it's the wrong business — return null
- BBB address match = high confidence. Search-only = medium. Unverified = low.

## Return JSON only — no other text:

{{
  "website": "https://example.com or null if not found",
  "bbb_url": "BBB page URL or null",
  "owner_name": "owner/principal name from BBB or null",
  "owner_title": "title if found or null",
  "phone": "phone number or null",
  "address_match": "exact if BBB address matches, partial if same city, none if no BBB",
  "confidence": "high, medium, or low",
  "source": "bbb, directory, search, or none"
}}
