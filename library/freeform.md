---
target_model: gpt-4.1-mini
temperature: 0.2
max_tokens: 1024
scenario: freeform
graduated: 2026-07-30
tokens: 60
---
Answer the request below.

Return ONLY a JSON object, no other text, no markdown fence:

{
  "text": "your complete answer as a single string"
}

Put the entire answer in `text`. If the answer is long or has multiple
paragraphs, keep it in that one string with newline characters — do not add
extra keys, and do not wrap the JSON in a code fence.

## Request

{user}
