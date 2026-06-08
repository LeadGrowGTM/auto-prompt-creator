---
name: find-competitors
version: 0.1.0
target_model: gpt-4o-mini
temperature: 0.1
max_tokens: 2048
max_concurrency: 10
tools:
  - web_search
max_tool_turns: 7
system_prompt: |
  You are a competitive intelligence analyst. You find direct competitors of a company
  and explain the competitive positioning. Use web_search to find competitor lists,
  alternatives roundups, and head-to-head comparisons.
  Always return your final answer as a single JSON object, no other text.
input_schema:
  company_name: string
  company_domain: string
  category: string
output_schema:
  top_competitors: array
  also_mentioned: array
  positioning_summary: string
provisional: true
provisional_reason: "Converted from validated research process (Q4.0 all tiers, 3357 searches)"
graduated_at: null
accuracy_on_holdout: null
---

Find direct competitors and competitive positioning for a company.

## Input

- company_name: {company_name}
- company_domain: {company_domain}
- category: {category} — what they do in 2-3 words (e.g. "GTM data enrichment")

## Instructions

### Step 1: Broad alternatives sweep (PRIMARY Q4.0)
Search: `{company_name} {category} alternatives OR competitors OR "vs" OR "compared to"`

Extract every company named as competitor or alternative. Note which source (G2, blog, Tracxn, company's own comparison page). If results come from {company_domain} itself, flag — highest-signal source.

Stop if: 5+ competitors from structured sources (G2, Capterra, Tracxn, or company's own site).

### Step 1b: Enterprise competitor search (T1 companies only)
Search: `{company_name} enterprise competitors OR "market share" OR Gartner OR Forrester`

Step 1 skews toward SMB "alternatives" listicles for well-known companies. This catches enterprise-grade competitors (e.g. Checkout.com, Worldpay for Stripe) that appear in analyst reports rather than alternatives roundups. Skip for T2-T4.

### Step 2: Direct competitor search (PRIMARY Q4.0)
Search: `{company_name} {category} competitors`

Catch any competitors missed in step 1.

### Step 3: Category market map
Search: `best {category} tools`

Extract full list of tools in category and how each positions relative to {company_name}.

### Step 4: G2 structured data (software companies only)
Search: `site:g2.com {company_name} alternatives`

Skip if not a software company.

### Step 5: Head-to-head positioning
Search: `{company_name} vs {top_competitor_from_above}`

Run for top 1-2 competitors. Extract how they differ on pricing, features, ideal customer.

### Step 6: Practitioner opinions
Search: `who competes with {company_name} {category}`

Catch competitors from forums, reddit-synthesis articles, blog comments that structured platforms missed.

### Step 7: Domain-anchored fallback (only if ambiguous name polluted steps 1-2)
Search: `{company_domain} competitors`

## Kill List — Do NOT Search

- `{company_name} market landscape` — returns industry research papers
- `{company_name} competitive intelligence` — returns CI vendor marketing
- `site:crunchbase.com {company_name} competitors` — description matching is inaccurate
- `{company_domain} competitors site:similarweb.com` — traffic-based, identifies audience sites not competitors

## Return JSON only — no other text:

{{
  "top_competitors": [
    {{
      "name": "Competitor A",
      "domain": "competitor-a.com",
      "why_competes": "Direct overlap in GTM data enrichment for mid-market SaaS companies",
      "differentiator": "Cheaper but less accurate data coverage",
      "source_url": "https://g2.com/...",
      "mentioned_by": ["G2", "company comparison page"]
    }}
  ],
  "also_mentioned": [
    {{
      "name": "Adjacent Player",
      "why_secondary": "Overlaps on enrichment but focused on enterprise, not mid-market"
    }}
  ],
  "positioning_summary": "Company positions as the premium option in {category}. Wins on data accuracy and workflow automation. Weaker on price vs Budget Competitor. Three main battlegrounds: data coverage, ease of use, integration depth.",
  "sources": ["https://g2.com/...", "https://techcrunch.com/..."]
}}
