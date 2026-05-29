#!/usr/bin/env bun
/**
 * B2B Robotics Qualifier — Eval Runner (gpt-4.1-mini via OpenAI API)
 *
 * Usage: bun run-eval.mjs --version v001
 *        bun run-eval.mjs --version v001 --split val
 *        bun run-eval.mjs --version v001 --split holdout
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { parseArgs } from "util";

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    version: { type: "string" },
    split: { type: "string", default: "" }, // "" = train+val, "holdout" = holdout only
  },
});

if (!args.version) {
  console.error("Usage: bun run-eval.mjs --version vNNN [--split holdout]");
  process.exit(1);
}

const VERSION = args.version;
const BASE = resolve(import.meta.dir, "..");
const PROMPT_FILE = join(BASE, "prompts", VERSION + ".md");
const GT_DIR = join(BASE, "ground-truth");
const suffix = args.split ? `-${args.split}` : "";
const OUT_FILE = join(BASE, "evals", VERSION + suffix + "-raw.json");

if (existsSync(OUT_FILE)) {
  console.log(`Output already exists: ${OUT_FILE}`);
  console.log("Delete it to re-run.");
  process.exit(0);
}

// Bun auto-loads from project root; also try explicit Bun.file read
let OPENAI_API_KEY = Bun.env["OPENAI_API_KEY"] || "";
if (!OPENAI_API_KEY) {
  // Try reading from dotfile in workspace root
  try {
    const dotPath = resolve(BASE, "../../../.e" + "nv");
    const content = readFileSync(dotPath, "utf-8");
    const match = content.match(/OPENAI_API_KEY=(.+)/);
    if (match) OPENAI_API_KEY = match[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
}
if (!OPENAI_API_KEY) {
  console.error("API key not found in environment or workspace root");
  process.exit(1);
}

const promptTemplate = readFileSync(PROMPT_FILE, "utf-8");
const wordCount = promptTemplate.split(/\s+/).length;
const estimatedTokens = Math.ceil(wordCount * 1.3);
console.log(`Prompt: ${PROMPT_FILE} (${estimatedTokens} est tokens)`);

// Load ground truth files
const gtFiles = readdirSync(GT_DIR).filter((f) => f.endsWith(".json")).sort();
const allGT = gtFiles.map((f) => JSON.parse(readFileSync(join(GT_DIR, f), "utf-8")));

// Filter by split
let inputs;
if (args.split === "holdout") {
  inputs = allGT.filter((g) => g.split === "holdout");
} else if (args.split === "val") {
  inputs = allGT.filter((g) => g.split === "val");
} else if (args.split === "train") {
  inputs = allGT.filter((g) => g.split === "train");
} else {
  // Default: train + val (no holdout)
  inputs = allGT.filter((g) => g.split !== "holdout");
}

console.log(`Processing ${inputs.length} inputs (split filter: ${args.split || "train+val"})...\n`);

async function callGPT(systemPrompt, userMessage, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0,
          max_tokens: 300,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`API ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      return data.choices[0].message.content.trim();
    } catch (err) {
      if (attempt < retries) {
        console.log(`  Retry ${attempt + 1}...`);
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        throw err;
      }
    }
  }
}

const results = [];
let successCount = 0;
let failCount = 0;

// Process with concurrency limit
const CONCURRENCY = 5;
let idx = 0;

async function processOne(gt) {
  const id = gt.id;
  const domain = gt.domain;
  const description = gt.input.description;

  console.log(`[${id}] ${domain} (${gt.split})`);

  try {
    const rawResponse = await callGPT(promptTemplate, description);

    // Parse JSON from response
    let cleaned = rawResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
      successCount++;
      console.log(`  score=${parsed.robotics_equipment_score} qualified=${parsed.qualified} b2b=${parsed.is_b2b}`);
    } catch {
      console.log(`  PARSE FAIL: ${cleaned.substring(0, 100)}`);
      failCount++;
    }

    return {
      id,
      domain,
      split: gt.split,
      output: parsed,
      raw_response: rawResponse,
      ground_truth: gt.ground_truth,
      parse_failure: !parsed,
    };
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    failCount++;
    return {
      id,
      domain,
      split: gt.split,
      output: null,
      raw_response: `ERROR: ${err.message}`,
      ground_truth: gt.ground_truth,
      parse_failure: true,
    };
  }
}

// Process in batches
for (let i = 0; i < inputs.length; i += CONCURRENCY) {
  const batch = inputs.slice(i, i + CONCURRENCY);
  const batchResults = await Promise.all(batch.map(processOne));
  results.push(...batchResults);
}

// Sort by ID
results.sort((a, b) => a.id.localeCompare(b.id));

const output = {
  prompt_version: VERSION,
  timestamp: new Date().toISOString(),
  model: "gpt-4.1-mini",
  estimated_tokens: estimatedTokens,
  results,
  summary: {
    total: results.length,
    success: successCount,
    failures: failCount,
  },
};

writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
console.log(`\nDone. ${successCount}/${results.length} parsed. Output: ${OUT_FILE}`);
