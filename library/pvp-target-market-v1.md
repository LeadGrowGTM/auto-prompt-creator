---
target_model: claude-haiku-4-5-20251001
scenario: pvp-target-market-v1
graduated: 2026-05-12
tokens: 500
---
You are identifying who BUYS FROM a company. Given the company name, industry, and why they raised funding, output the types of businesses that are their customers and the job titles that control the budget.

## Examples

**Veeva Systems | cloud software for life sciences. Raised to expand CRM platform for pharmaceutical sales reps.**
- Business Types: pharmaceutical companies and biotech firms
- Decision Makers: VP of commercial operations and CIO

**Procore | construction management software. Raised to expand project management tools for general contractors.**
- Business Types: general contractors and construction firms
- Decision Makers: project managers and VP of operations

**Joby Aviation | electric aircraft manufacturing. Raised to scale eVTOL production for urban air taxi service.**
- Business Types: urban mobility operators and commercial airlines
- Decision Makers: head of fleet operations and VP of transportation

**Magrathea | metal manufacturing. Raised to expand lithium refining capacity.**
- Business Types: battery manufacturers and electric vehicle companies
- Decision Makers: supply chain directors and VP of procurement

**ACRIOS Systems | industrial automation. Raised to provide unified IoT development stack for manufacturers.**
- Business Types: manufacturers and industrial facilities
- Decision Makers: plant managers and VP of engineering

**Kanvas Biosciences | biotech research services. Raised to conduct clinical trials for oncology diagnostics.**
- Business Types: pharmaceutical companies and cancer research centers
- Decision Makers: VP of R&D and chief scientific officers

**Kani Payments | payment processing. Raised to expand payment infrastructure for fintech startups.**
- Business Types: fintech companies and digital banks
- Decision Makers: CFOs and VP of payments

**Scout Space | coworking space. Raised to expand satellite-based workspace connectivity.**
- Business Types: remote-first companies and satellite communications firms
- Decision Makers: VP of real estate and chief operating officers

**Meatly | food production. Raised to scale cultivated meat production for food retailers.**
- Business Types: food retailers and restaurant chains
- Decision Makers: head of product development and VP of procurement

## Company

{company_name} | {company_description}

Output ONLY:
- Business Types: [buyer type 1] and [buyer type 2]
- Decision Makers: [title 1] and [title 2]

Rules: plural labels, lowercase, "and" separator. Identify the BUYER's industry, not the seller's.
IMPORTANT: Always provide an answer. If information is sparse, make a reasonable inference from the industry label alone. Never ask for more information.
