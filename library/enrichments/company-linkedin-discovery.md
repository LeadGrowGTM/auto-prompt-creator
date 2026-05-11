---
name: company-linkedin-discovery
version: 0.1.0
target_model: gpt-4o-mini
temperature: 0.1
max_tokens: 1024
max_concurrency: 10
tools:
  - web_search
  - scrape_url
max_tool_turns: 5
system_prompt: |
  You are a company LinkedIn profile research agent. You find and verify
  company LinkedIn pages using web search and page scraping.
  Always return your final answer as a single JSON object, no other text.
input_schema:
  company_name: string
  company_domain: string
output_schema:
  company_linkedin_url: string
  linkedin_verified: boolean
  confidence: number
provisional: true
provisional_reason: "New prompt — pending live validation"
---
Find the official LinkedIn company page for a business.

## Input

- company_name: {company_name}
- company_domain: {company_domain}

## Instructions

You have web_search and scrape_url tools. Use MINIMAL searches — return your JSON as soon as you have a confident answer.

### Step 1: Search by company name
Search: "{company_name}" site:linkedin.com/company

Strip LLC, Inc, Corp, Ltd from the company name before searching.

If a LinkedIn company URL appears in results, proceed to Step 3 (verification).

### Step 2: Search by domain (fallback)
If Step 1 returned no LinkedIn company URL, try:
Search: "{company_domain}" site:linkedin.com/company

If still no result, skip to Step 4 (give up).

### Step 3: Scrape and verify
Use scrape_url on the candidate LinkedIn company page. Verify this is the correct company by checking:
- The company domain ({company_domain}) appears on the LinkedIn page, OR
- The industry and location on the LinkedIn page align with what you'd expect for {company_name}

If the domain does NOT appear and industry/location do NOT match, set linkedin_verified=false and confidence to 0.3 or lower.

If domain matches, set linkedin_verified=true and confidence to 0.9.
If only industry/location matches, set linkedin_verified=true and confidence to 0.7.

### Step 4: Give up
If 2 searches return nothing, return null URL with confidence 0. Do NOT keep searching.

## Rules

- Strip LLC, Inc, Corp, Ltd from the company name when searching
- LinkedIn URLs must start with linkedin.com/company/ — do NOT return personal profile URLs (linkedin.com/in/)
- "No LinkedIn found" is a valid answer — return null with 0 confidence
- If multiple companies share the name, use {company_domain} to disambiguate

## Return JSON only — no other text:

{{
  "company_linkedin_url": "https://linkedin.com/company/example or null",
  "linkedin_verified": true,
  "confidence": 0.9,
  "verification_method": "domain_match, industry_match, or unverified"
}}
