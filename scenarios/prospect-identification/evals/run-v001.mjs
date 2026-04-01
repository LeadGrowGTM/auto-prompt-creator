import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

const BASE = process.argv[2] || 'C:/Users/mitch/Everything_CC/auto-prompt-creator/scenarios/prospect-identification';
const PROMPT_FILE = join(BASE, 'prompts/v001.md');
const GT_DIR = join(BASE, 'ground-truth');
const OUT_FILE = join(BASE, 'evals/v001-raw.json');

const promptTemplate = readFileSync(PROMPT_FILE, 'utf8');

// Get all ground truth files, sorted alphabetically
const gtFiles = readdirSync(GT_DIR)
  .filter(f => f.endsWith('.json'))
  .sort();

console.log(`Processing ${gtFiles.length} inputs...`);

const results = [];
let successCount = 0;
let failCount = 0;
let missingFieldTotal = 0;
let wordCountViolations = 0;

const REQUIRED_FIELDS = ['businessTypes', 'decisionMakers'];

// Create a temp directory for prompt files
const tmpDir = mkdtempSync(join(tmpdir(), 'haiku-'));

for (const file of gtFiles) {
  const gt = JSON.parse(readFileSync(join(GT_DIR, file), 'utf8'));
  const inputId = gt.id;
  const split = gt.split;
  const input = gt.input;

  // Build the full prompt
  const fullPrompt = `${promptTemplate}\n\n${input.company_name}: ${input.company_description}`;

  console.log(`\n--- Processing: ${inputId} (${split}) ---`);

  let rawResponse = '';
  let haikuOutput = null;
  let parseFailure = false;
  let missingFields = [];
  let wordCountWarnings = [];

  try {
    // Write prompt to a temp file to avoid shell escaping issues (pipe chars, quotes)
    const tmpFile = join(tmpDir, `${inputId}.txt`);
    writeFileSync(tmpFile, fullPrompt);

    // Call Haiku via claude CLI, piping prompt from file to avoid shell escaping
    const bashPath = 'C:\\Program Files\\Git\\usr\\bin\\bash.exe';
    rawResponse = execSync(
      `cat "${tmpFile.replace(/\\/g, '/')}" | claude --print --model haiku --allowedTools ""`,
      { encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024, shell: bashPath }
    ).trim();

    console.log(`Raw response (first 200 chars): ${rawResponse.substring(0, 200)}`);

    // Clean up response - strip code fences if present
    let cleaned = rawResponse;
    cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    cleaned = cleaned.trim();

    // Try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    try {
      haikuOutput = JSON.parse(cleaned);

      // Validate required fields
      for (const field of REQUIRED_FIELDS) {
        if (!(field in haikuOutput)) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        console.log(`  Missing fields: ${missingFields.join(', ')}`);
        missingFieldTotal += missingFields.length;
      }

      // Validate word counts (warnings only — don't fail)
      if (haikuOutput.businessTypes) {
        const btWords = haikuOutput.businessTypes.trim().split(/\s+/).length;
        if (btWords > 7) {
          const msg = `businessTypes word count ${btWords} exceeds 7: "${haikuOutput.businessTypes}"`;
          console.log(`  WARNING: ${msg}`);
          wordCountWarnings.push(msg);
          wordCountViolations++;
        }
      }

      if (haikuOutput.decisionMakers) {
        const dmWords = haikuOutput.decisionMakers.trim().split(/\s+/).length;
        if (dmWords > 6) {
          const msg = `decisionMakers word count ${dmWords} exceeds 6: "${haikuOutput.decisionMakers}"`;
          console.log(`  WARNING: ${msg}`);
          wordCountWarnings.push(msg);
          wordCountViolations++;
        }
      }

      parseFailure = false;
      successCount++;
      console.log(`  Parsed successfully. businessTypes: ${haikuOutput.businessTypes}`);
    } catch (parseErr) {
      console.log(`  Parse failure: ${parseErr.message}`);
      parseFailure = true;
      haikuOutput = null;
      failCount++;
    }
  } catch (execErr) {
    console.log(`  Agent error: ${execErr.message}`);
    rawResponse = `AGENT_ERROR: ${execErr.message}`;
    parseFailure = true;
    haikuOutput = null;
    failCount++;
  }

  results.push({
    input_id: inputId,
    split: split,
    haiku_output: haikuOutput,
    raw_response: rawResponse,
    parse_failure: parseFailure,
    missing_fields: missingFields,
    word_count_warnings: wordCountWarnings
  });
}

const output = {
  prompt_version: 'v001',
  timestamp: new Date().toISOString(),
  config: {
    target_model: 'haiku',
    prompt_file: 'prompts/v001.md'
  },
  results: results,
  summary: {
    total_inputs: results.length,
    successful_parses: successCount,
    parse_failures: failCount,
    missing_field_count: missingFieldTotal,
    word_count_violations: wordCountViolations
  }
};

writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
console.log(`\n=== COMPLETE ===`);
console.log(`Total: ${results.length}, Success: ${successCount}, Failures: ${failCount}`);
console.log(`Word count violations: ${wordCountViolations}`);
console.log(`Output written to: ${OUT_FILE}`);
