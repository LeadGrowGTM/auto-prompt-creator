#!/usr/bin/env bun
/**
 * ICP Classification — Parameterized Eval Runner
 *
 * Usage:
 *   bun scenarios/icp-classification/evals/run-eval.mjs --version v001
 *   bun scenarios/icp-classification/evals/run-eval.mjs --version v003
 */

import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { parseArgs } from "util";
import { $ } from "bun";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    version: { type: "string" },
  },
});

if (!values.version) {
  console.error("Usage: bun run-eval.mjs --version v001");
  process.exit(1);
}

const VERSION = values.version;
const BASE = resolve(import.meta.dir, "..");
const PROMPT_FILE = join(BASE, `prompts/${VERSION}.md`);
const GT_DIR = join(BASE, "ground-truth");
const OUT_FILE = join(BASE, `evals/${VERSION}-raw.json`);

const REQUIRED_FIELDS = [
  "industry",
  "company_size",
  "decision_makers",
  "pain_points",
  "icp_fit",
  "reasoning",
];

// Read prompt template
const promptTemplate = readFileSync(PROMPT_FILE, "utf8");

// Token estimation
const wordCount = promptTemplate.split(/\s+/).length;
const estimatedTokens = Math.ceil(wordCount * 1.3);
console.log(`Prompt: ${PROMPT_FILE}`);
console.log(`Token estimate: ${estimatedTokens} (${wordCount} words * 1.3)`);
if (estimatedTokens >= 700) console.log("WARNING: CONSOLIDATION TRIGGER (700+ tokens)");
if (estimatedTokens >= 800) console.log("ERROR: TOKEN BUDGET EXCEEDED (800+ tokens)");

// Get all ground truth files
const gtFiles = readdirSync(GT_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

console.log(`Processing ${gtFiles.length} inputs...\n`);

const results = [];
let successCount = 0;
let failCount = 0;
let missingFieldTotal = 0;

// Create temp dir for prompt files
const tmpDir = mkdtempSync(join(tmpdir(), "haiku-"));

for (const file of gtFiles) {
  const gt = JSON.parse(readFileSync(join(GT_DIR, file), "utf8"));
  const inputId = gt.id;
  const split = gt.split;
  const input = gt.input;

  const fullPrompt = `${promptTemplate}\n\n${input.company_name}: ${input.company_description}`;

  console.log(`--- Processing: ${inputId} (${split}) ---`);

  let rawResponse = "";
  let haikuOutput = null;
  let parseFailure = false;
  let missingFields = [];

  try {
    // Write prompt to temp file to avoid shell escaping issues
    const tmpFile = join(tmpDir, `${inputId}.txt`);
    writeFileSync(tmpFile, fullPrompt);
    const tmpFilePosix = tmpFile.replace(/\\/g, "/");

    // Call Haiku via claude CLI using Bun shell
    const result =
      await $`cat ${tmpFilePosix} | claude --print --model haiku --allowedTools ""`.text();
    rawResponse = result.trim();

    console.log(`Raw response (first 200 chars): ${rawResponse.substring(0, 200)}`);

    // Clean up response - strip code fences if present
    let cleaned = rawResponse;
    cleaned = cleaned.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    cleaned = cleaned.trim();

    // Extract JSON from response
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
        console.log(`  Missing fields: ${missingFields.join(", ")}`);
        missingFieldTotal += missingFields.length;
      }

      parseFailure = false;
      successCount++;
      console.log(`  Parsed successfully. icp_fit: ${haikuOutput.icp_fit}`);
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
    id: inputId,
    company: input.company_name,
    split: split,
    output: haikuOutput ? JSON.stringify(haikuOutput) : rawResponse,
    tokens: estimatedTokens,
    groundTruth: gt.expected_output || {},
    // Extended fields for compatibility with existing scorers
    haiku_output: haikuOutput,
    raw_response: rawResponse,
    parse_failure: parseFailure,
    missing_fields: missingFields,
  });
}

const output = {
  prompt_version: VERSION,
  timestamp: new Date().toISOString(),
  config: {
    target_model: "haiku",
    prompt_file: `prompts/${VERSION}.md`,
  },
  results: results,
  summary: {
    total_inputs: results.length,
    successful_parses: successCount,
    parse_failures: failCount,
    missing_field_count: missingFieldTotal,
    estimated_tokens: estimatedTokens,
  },
};

writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
console.log(`\n=== COMPLETE ===`);
console.log(`Total: ${results.length}, Success: ${successCount}, Failures: ${failCount}`);
console.log(`Output written to: ${OUT_FILE}`);
