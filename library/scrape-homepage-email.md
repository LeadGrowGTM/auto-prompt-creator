---
target_model: gpt-4.1-mini
temperature: 0.1
max_tokens: 1024
max_concurrency: 25
tools:
  - scrape_url
max_tool_turns: 3
system_prompt: |
  You are a business intelligence agent. You scrape company homepages to extract
  contact emails and classify the business type. Return your final answer as a
  single JSON object, no other text.
---
Scrape the homepage for this business and extract contact information.

Website: {website}
Company: {company_name}
Segment: {segment}

## Instructions

Use scrape_url to fetch the homepage at {website}.

From the scraped content, extract:

1. **Emails** — any email addresses visible on the page (info@, contact@, sales@, support@, personal emails). Extract ALL emails found.

2. **Business category** — classify what this business actually does. Use a short phrase (e.g. "restaurant", "general contractor", "dental practice", "mca lender", "equipment finance broker", "law firm", "staffing agency").

3. **Competitor flag** — is this business a financial services competitor? Flag as true if the business is ANY of:
   - MCA / merchant cash advance provider or broker
   - Business loan lender or broker
   - Debt consolidation / restructuring firm (NOT the borrower — the service provider)
   - Equipment finance lender or broker
   - Factoring company
   - SBA loan broker or lender
   - Commercial loan provider
   - Financial services / fintech lending platform
   - Law firm specializing in business debt or UCC filings

   Flag as false for all other businesses — these are potential CLIENTS (borrowers), not competitors.

4. **Homepage summary** — 1-2 sentence description of what the business does, from the homepage content.

## Rules
- If scrape_url fails or returns empty content, return null fields with scrape_failed: true
- If the page is a parking page, redirect, or "site not found", set is_parked: true
- Do NOT follow links to subpages — homepage only
- Extract emails exactly as found (preserve case)

## Return JSON only — no other text:

{{
  "emails": ["email1@example.com", "email2@example.com"],
  "primary_email": "most likely general contact email or null",
  "business_category": "short category phrase",
  "is_competitor": true or false,
  "competitor_type": "mca lender, loan broker, etc. or null if not competitor",
  "homepage_summary": "1-2 sentence description",
  "scrape_failed": false,
  "is_parked": false
}}
