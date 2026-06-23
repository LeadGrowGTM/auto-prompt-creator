#!/usr/bin/env bun
/**
 * Auto Prompt Creator — Scenario Setup
 *
 * Scaffolds a new scenario directory with all required files.
 *
 * Usage:
 *   bun setup.mjs --name my-scenario
 *   bun setup.mjs --name my-scenario --mode icp-loop
 *   bun setup.mjs --name my-scenario --dimensions "accuracy:0.5,format:0.3,style:0.2"
 *   bun setup.mjs --name my-scenario --threshold 0.90 --budget 600
 *
 * Modes:
 *   standard   (default) — classic anneal loop, runs all inputs per iteration
 *   icp-loop   — interactive human validation: 10 companies at a time, gate on
 *                3 consecutive clean batches before graduation
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    name: { type: "string" },
    description: { type: "string", default: "" },
    dimensions: { type: "string", default: "accuracy:0.50,format:0.30,style:0.20" },
    threshold: { type: "string", default: "0.92" },
    budget: { type: "string", default: "800" },
    iterations: { type: "string", default: "10" },
    mode: { type: "string", default: "standard" }, // "standard" | "icp-loop"
  },
});

if (!values.name) {
  console.error("Usage: bun setup.mjs --name <scenario-name> [--mode icp-loop]");
  console.error("Options:");
  console.error('  --description "What this prompt does"');
  console.error('  --dimensions "accuracy:0.5,format:0.3,style:0.2"');
  console.error("  --threshold 0.92");
  console.error("  --budget 800");
  console.error("  --iterations 10");
  console.error("  --mode standard|icp-loop");
  process.exit(1);
}

const name = values.name;
const mode = values.mode;
if (mode !== "standard" && mode !== "icp-loop") {
  console.error(`Unknown mode: ${mode}. Use "standard" or "icp-loop".`);
  process.exit(1);
}

const root = resolve(import.meta.dir, "scenarios", name);

if (existsSync(root)) {
  console.error("Scenario already exists at " + root);
  process.exit(1);
}

// Parse dimensions
const dims = {};
const dimNames = [];
for (const part of values.dimensions.split(",")) {
  const [dimName, weight] = part.split(":");
  const trimmed = dimName.trim();
  dims[trimmed] = {
    weight: parseFloat(weight),
    description: "[TODO] Describe what " + trimmed + " measures",
  };
  dimNames.push(trimmed);
}

// Create directories
const dirs = ["inputs", "ground-truth", "evals", "prompts"];
mkdirSync(root, { recursive: true });
for (const dir of dirs) {
  mkdirSync(join(root, dir), { recursive: true });
}

// Write scenario.json
const scenario = {
  name,
  description: values.description || "[TODO] Describe the " + name + " task",
  model: "claude-haiku-4-5-20251001",
  rubric: { dimensions: dims },
  accuracy_threshold: parseFloat(values.threshold),
  max_iterations: parseInt(values.iterations),
  token_budget: parseInt(values.budget),
  overfitting_threshold: 0.12,
  default_iterations: parseInt(values.iterations),
  data_split: {
    train: 0.60,
    validation: 0.30,
    holdout: 0.10,
    min_examples: 12,
    recommended_examples: 15,
  },
  mutation_phases: {
    bootstrap: [1, 3],
    generalize: [4, 7],
    polish: [8, parseInt(values.iterations)],
  },
  example_cap_per_concept: 4,
};

if (mode === "icp-loop") {
  scenario.icp_loop = {
    enabled: true,
    batch_size: 10,
    clean_rounds_required: 3,
    // Model used during interactive validation (higher quality than scoring model)
    model: "claude-sonnet-4-6",
    show_reasoning: true,
  };
}

writeFileSync(join(root, "scenario.json"), JSON.stringify(scenario, null, 2) + "\n");

// Write loop-state.json
const loopState = {
  scenario: name,
  current_iteration: 0,
  best_version: null,
  best_validation_score: 0,
  last_mutation_type: null,
  halt_reason: null,
  config: {
    accuracy_threshold: scenario.accuracy_threshold,
    max_iterations: scenario.max_iterations,
    token_budget: scenario.token_budget,
    overfitting_threshold: scenario.overfitting_threshold,
  },
  score_history: [],
  consecutive_plateaus: 0,
};

if (mode === "icp-loop") {
  loopState.icp_loop = {
    clean_rounds: 0,
    current_batch_offset: 0,
    total_batches_reviewed: 0,
    gate_cleared: false,
    corrections_history: [],
  };
}

writeFileSync(join(root, "evals", "loop-state.json"), JSON.stringify(loopState, null, 2) + "\n");

// Write placeholder v001.md
writeFileSync(
  join(root, "prompts", "v001.md"),
  "[TODO] Paste your baseline prompt here.\n\nThis is the starting point for optimization.\n"
);

// Write example input template
const exampleInput = {
  _comment: "[TODO] Replace these fields with your scenario's input schema",
  field1: "[TODO] Primary input field",
  field2: "[TODO] Secondary input field",
};
writeFileSync(join(root, "inputs", "example.json"), JSON.stringify(exampleInput, null, 2) + "\n");

// Write example ground truth template
const exampleGT = {
  id: "example",
  split: "train",
  input: {
    _comment: "[TODO] Same fields as your input files",
    field1: "example input value",
    field2: "example input value",
  },
  ground_truth: {
    _comment: "[TODO] The expected output fields for this input",
    output_field1: "expected value 1",
    output_field2: "expected value 2",
  },
};
writeFileSync(join(root, "ground-truth", "example.json"), JSON.stringify(exampleGT, null, 2) + "\n");

// ─── run-eval.mjs — Anthropic Flex API ────────────────────────────────────────

const runEvalTemplate = `#!/usr/bin/env bun
/**
 * Eval runner for ${name} — Anthropic REST API, service_tier: flex
 *
 * Usage:
 *   bun run-eval.mjs --version v001
 *   bun run-eval.mjs --version v001 --split val
 *   bun run-eval.mjs --version v001 --split holdout
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { parseArgs } from "util";

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    version: { type: "string" },
    split: { type: "string", default: "" },
  },
});

if (!args.version) {
  console.error("Usage: bun run-eval.mjs --version vNNN [--split val|holdout]");
  process.exit(1);
}

const VERSION = args.version;
const BASE = resolve(import.meta.dir, "..");
const PROMPT_FILE = join(BASE, "prompts", VERSION + ".md");
const GT_DIR = join(BASE, "ground-truth");
const suffix = args.split ? \`-\${args.split}\` : "";
const OUT_FILE = join(BASE, "evals", VERSION + suffix + "-raw.json");

if (existsSync(OUT_FILE)) {
  console.log(\`Output already exists: \${OUT_FILE}. Delete to re-run.\`);
  process.exit(0);
}

const ANTHROPIC_API_KEY = Bun.env["ANTHROPIC_API_KEY"] || "";
if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not found in environment.");
  process.exit(1);
}

const scenarioConfig = JSON.parse(readFileSync(join(BASE, "scenario.json"), "utf-8"));
const MODEL = scenarioConfig.model || "claude-haiku-4-5-20251001";

const promptTemplate = readFileSync(PROMPT_FILE, "utf-8");
const estimatedTokens = Math.ceil(promptTemplate.split(/\\s+/).length * 1.3);
console.log(\`Prompt: \${PROMPT_FILE} (\${estimatedTokens} est tokens)\`);
if (estimatedTokens > 700) console.log("  WARNING: CONSOLIDATION TRIGGER (>700 tokens)");
if (estimatedTokens > 800) console.log("  ERROR: TOKEN BUDGET EXCEEDED (>800 tokens)");

const gtFiles = readdirSync(GT_DIR).filter((f) => f.endsWith(".json")).sort();
const allGT = gtFiles.map((f) => JSON.parse(readFileSync(join(GT_DIR, f), "utf-8")));

let inputs;
if (args.split === "holdout") inputs = allGT.filter((g) => g.split === "holdout");
else if (args.split === "val")  inputs = allGT.filter((g) => g.split === "val");
else if (args.split === "train") inputs = allGT.filter((g) => g.split === "train");
else inputs = allGT.filter((g) => g.split !== "holdout");

console.log(\`Processing \${inputs.length} inputs (\${args.split || "train+val"})...\\n\`);

async function callClaude(systemPrompt, userMessage, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 512,
          service_tier: "flex",
          system: systemPrompt,
          // [TODO] Customize this for your scenario's input format
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(\`API \${resp.status}: \${errText}\`);
      }

      const data = await resp.json();
      return data.content[0].type === "text" ? data.content[0].text.trim() : "";
    } catch (err) {
      if (attempt < retries) {
        console.log(\`  Retry \${attempt + 1}...\`);
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        throw err;
      }
    }
  }
}

const results = [];
let successCount = 0, failCount = 0;

async function processOne(gt) {
  const id = gt.id;
  console.log(\`[\${id}] (\${gt.split})\`);
  try {
    const rawText = await callClaude(promptTemplate, JSON.stringify(gt.input));
    let cleaned = rawText.replace(/\`\`\`json\\s*/g, "").replace(/\`\`\`\\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\\{[\\s\\S]*\\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
      successCount++;
      console.log(\`  OK: \${JSON.stringify(parsed).substring(0, 100)}\`);
    } catch {
      console.log(\`  PARSE FAIL: \${cleaned.substring(0, 100)}\`);
      failCount++;
    }
    return { id, split: gt.split, output: parsed, raw_response: rawText, ground_truth: gt.ground_truth, parse_failure: !parsed };
  } catch (err) {
    console.log(\`  ERROR: \${err.message}\`);
    failCount++;
    return { id, split: gt.split, output: null, raw_response: \`ERROR: \${err.message}\`, ground_truth: gt.ground_truth, parse_failure: true };
  }
}

const CONCURRENCY = 5;
for (let i = 0; i < inputs.length; i += CONCURRENCY) {
  const batch = inputs.slice(i, i + CONCURRENCY);
  const batchResults = await Promise.all(batch.map(processOne));
  results.push(...batchResults);
}

results.sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(OUT_FILE, JSON.stringify({
  prompt_version: VERSION,
  timestamp: new Date().toISOString(),
  model: MODEL,
  service_tier: "flex",
  estimated_tokens: estimatedTokens,
  results,
  summary: { total: results.length, success: successCount, failures: failCount },
}, null, 2));

console.log(\`\\nDone. \${successCount}/\${results.length} parsed. Output: \${OUT_FILE}\`);
`;

writeFileSync(join(root, "evals", "run-eval.mjs"), runEvalTemplate);

// ─── judge.mjs ────────────────────────────────────────────────────────────────

const judgeTemplate = `#!/usr/bin/env bun
/**
 * Semi-automated judge for ${name}
 *
 * Usage:
 *   bun judge.mjs --version v001              # Generate score template for manual review
 *   bun judge.mjs --version v001 --finalize   # Compute final scores from filled template
 *   bun judge.mjs --version v001 --auto       # Auto-score with Opus (3x median)
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { parseArgs } from "util";
import { normalizeScore, weightedScore, aggregateScores } from "../../../lib/score.mjs";

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    version: { type: "string" },
    finalize: { type: "boolean", default: false },
    auto: { type: "boolean", default: false },
  },
});

if (!args.version) {
  console.error("Usage: bun judge.mjs --version vNNN [--finalize | --auto]");
  process.exit(1);
}

const version = args.version;
const scenarioDir = resolve(import.meta.dir, "..");
const evalsDir = import.meta.dir;
const rawFile = join(evalsDir, version + "-raw.json");
const templateFile = join(evalsDir, version + "-scores-template.json");
const outFile = join(evalsDir, version + ".json");
const scenarioConfig = JSON.parse(readFileSync(join(scenarioDir, "scenario.json"), "utf-8"));
const rubric = scenarioConfig.rubric.dimensions;

const rawOutputs = JSON.parse(readFileSync(rawFile, "utf-8"));
// Support both flat array (legacy) and {results:[...]} shape
const rawArr = Array.isArray(rawOutputs) ? rawOutputs : rawOutputs.results;

if (args.finalize) {
  if (!existsSync(templateFile)) {
    console.error("No score template found at " + templateFile);
    console.error("Run without --finalize first to generate the template.");
    process.exit(1);
  }

  const template = JSON.parse(readFileSync(templateFile, "utf-8"));
  const perInput = [];

  const weights = Object.fromEntries(
    Object.entries(rubric).map(([dim, config]) => [dim, config.weight])
  );

  for (const entry of template.inputs) {
    const dimensions = {};

    for (const [dim] of Object.entries(rubric)) {
      const raw = entry.scores[dim];
      if (raw === null || raw === undefined) {
        console.error("Missing score for " + entry.id + " dimension " + dim);
        process.exit(1);
      }
      const normalized = normalizeScore(raw);
      dimensions[dim] = { raw, normalized };
    }

    const normalizedDims = Object.fromEntries(
      Object.entries(dimensions).map(([dim, v]) => [dim, v.normalized])
    );

    perInput.push({
      input_id: entry.id,
      split: entry.split,
      weighted_score: Math.round(weightedScore(normalizedDims, weights) * 10000) / 10000,
      dimensions,
    });
  }

  const aggregated = aggregateScores(perInput);

  const dimAverages = {};
  for (const dim of Object.keys(rubric)) {
    dimAverages[dim] = Math.round(
      perInput.reduce((s, p) => s + p.dimensions[dim].normalized, 0) / perInput.length * 10000
    ) / 10000;
  }

  const output = {
    prompt_version: version,
    timestamp: new Date().toISOString(),
    config: { judge: "manual", normalization: "(score - 1) / 4" },
    aggregate: {
      overall_score: aggregated.overall_score,
      train_score: aggregated.train_score,
      validation_score: aggregated.validation_score,
      holdout_score: aggregated.holdout_score,
      dimension_averages: dimAverages,
    },
    per_input: perInput,
  };

  writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log("Wrote scored results to " + outFile);
  console.log("Overall: " + output.aggregate.overall_score);
  console.log("Train:   " + output.aggregate.train_score);
  console.log("Val:     " + output.aggregate.validation_score);
  if (output.aggregate.holdout_score) console.log("Holdout: " + output.aggregate.holdout_score);

} else {
  const semanticDims = Object.keys(rubric).filter((d) => d !== "format_comp" && d !== "format_compliance");

  const inputs = rawArr.map((raw) => ({
    id: raw.id,
    split: raw.split,
    model_output: raw.output || raw.raw_response,
    ground_truth: raw.ground_truth || raw.groundTruth,
    scores: Object.fromEntries(semanticDims.map((d) => [d, null])),
  }));

  const template = {
    prompt_version: version,
    instructions: "Score each dimension 1-5. 1=completely wrong, 2=partially correct, 3=right area but imprecise, 4=correct with minor wording diff, 5=exact match or equivalent to ground truth.",
    rubric: Object.fromEntries(Object.entries(rubric).filter(([k]) => semanticDims.includes(k)).map(([k, v]) => [k, v.description])),
    inputs,
  };

  writeFileSync(templateFile, JSON.stringify(template, null, 2));
  console.log("Score template written to " + templateFile);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Open " + templateFile);
  console.log("  2. Fill in scores (1-5) for each input and dimension");
  console.log("  3. Run: bun judge.mjs --version " + version + " --finalize");
}
`;

writeFileSync(join(root, "evals", "judge.mjs"), judgeTemplate);

// ─── icp-loop.mjs (icp-loop mode only) ───────────────────────────────────────

if (mode === "icp-loop") {
  const icpLoopTemplate = `#!/usr/bin/env bun
/**
 * ICP Loop — Interactive prompt validation with human review
 *
 * Feeds batches of N companies through the model (Anthropic Flex tier), shows
 * reasoning per company, collects corrections. Gate: clean_rounds_required
 * consecutive clean batches (zero corrections) before graduation is allowed.
 *
 * Usage:
 *   bun icp-loop.mjs --version v001
 *   bun icp-loop.mjs --version v001 --batch 3   # jump to specific batch number
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { parseArgs } from "util";
import { createInterface } from "readline";

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    version: { type: "string" },
    batch: { type: "string" },
  },
});

if (!args.version) {
  console.error("Usage: bun icp-loop.mjs --version vNNN [--batch N]");
  process.exit(1);
}

const ANTHROPIC_API_KEY = Bun.env["ANTHROPIC_API_KEY"] || "";
if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not found in environment.");
  process.exit(1);
}

const VERSION = args.version;
const BASE = resolve(import.meta.dir, "..");
const EVALS_DIR = import.meta.dir;
const stateFile = join(EVALS_DIR, "loop-state.json");

const scenarioConfig = JSON.parse(readFileSync(join(BASE, "scenario.json"), "utf-8"));
const icpConfig = scenarioConfig.icp_loop || {};
const BATCH_SIZE = icpConfig.batch_size || 10;
const CLEAN_ROUNDS_REQUIRED = icpConfig.clean_rounds_required || 3;
const MODEL = icpConfig.model || "claude-sonnet-4-6";

const state = JSON.parse(readFileSync(stateFile, "utf-8"));
if (!state.icp_loop) {
  state.icp_loop = {
    clean_rounds: 0,
    current_batch_offset: 0,
    total_batches_reviewed: 0,
    gate_cleared: false,
    corrections_history: [],
  };
}
const icpState = state.icp_loop;

if (icpState.gate_cleared) {
  console.log("Gate already cleared — " + CLEAN_ROUNDS_REQUIRED + " consecutive clean rounds achieved.");
  console.log("Run /anneal-prompt to graduate, or run full eval:");
  console.log("  bun run-eval.mjs --version " + VERSION);
  process.exit(0);
}

const promptFile = join(BASE, "prompts", VERSION + ".md");
const promptTemplate = readFileSync(promptFile, "utf-8");

// Load all inputs from ground-truth dir (sorted deterministically)
const gtDir = join(BASE, "ground-truth");
const allInputs = readdirSync(gtDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(gtDir, f), "utf-8")));

// Determine batch
const batchIndex = args.batch !== undefined
  ? parseInt(args.batch) - 1
  : Math.floor(icpState.current_batch_offset / BATCH_SIZE) % Math.ceil(allInputs.length / BATCH_SIZE);
const startIdx = (batchIndex * BATCH_SIZE) % allInputs.length;
const batch = [];
for (let i = 0; i < BATCH_SIZE; i++) {
  batch.push(allInputs[(startIdx + i) % allInputs.length]);
}

const batchNum = batchIndex + 1;
const totalBatches = Math.ceil(allInputs.length / BATCH_SIZE);

console.log("\\n--- ICP Loop | " + VERSION + " | Batch " + batchNum + "/" + totalBatches + " | Clean: " + icpState.clean_rounds + "/" + CLEAN_ROUNDS_REQUIRED + " ---\\n");
console.log("Model: " + MODEL + " (Flex)");
console.log("Classifying " + batch.length + " companies...\\n");

async function callFlex(systemPrompt, userMessage, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 600,
          service_tier: "flex",
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error("API " + resp.status + ": " + errText);
      }
      const data = await resp.json();
      return data.content[0].type === "text" ? data.content[0].text.trim() : "";
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        throw err;
      }
    }
  }
}

async function classifyOne(gt) {
  const id = gt.id;
  // Ask for explicit reasoning before JSON to make corrections actionable
  const userMsg =
    "Classify this company. In 2-3 sentences, explain your reasoning first. Then output your JSON classification.\\n\\n" +
    JSON.stringify(gt.input, null, 2);

  try {
    const text = await callFlex(promptTemplate, userMsg);
    const jsonMatch = text.match(/\\{[\\s\\S]*\\}/);
    let parsed = null;
    try { parsed = JSON.parse(jsonMatch?.[0] || ""); } catch {}
    const reasoning = text.replace(/\\{[\\s\\S]*\\}/, "").trim();
    return { id, input: gt.input, reasoning, parsed, ground_truth: gt.ground_truth };
  } catch (err) {
    return { id, input: gt.input, reasoning: "ERROR: " + err.message, parsed: null, ground_truth: gt.ground_truth };
  }
}

// Run batch concurrently (max 5 at a time)
const CONCURRENCY = 5;
const batchResults = [];
for (let i = 0; i < batch.length; i += CONCURRENCY) {
  const chunk = batch.slice(i, i + CONCURRENCY);
  const results = await Promise.all(chunk.map(classifyOne));
  batchResults.push(...results);
  process.stdout.write("  " + Math.min(i + CONCURRENCY, batch.length) + "/" + batch.length + " done\\r");
}
console.log("\\n");

// Interactive review
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const corrections = [];

for (let i = 0; i < batchResults.length; i++) {
  const r = batchResults[i];
  const companyName = r.input?.company_name || r.input?.name || r.id;

  console.log("[" + (i + 1) + "/" + batchResults.length + "] " + companyName);
  if (r.reasoning) console.log("  Reasoning : " + r.reasoning);
  console.log("  Result    : " + (r.parsed ? JSON.stringify(r.parsed) : "(PARSE FAIL — no JSON in response)"));

  const answer = await ask("  [Enter=accept, type correction]: ");

  if (answer.trim()) {
    corrections.push({
      id: r.id,
      company: companyName,
      model_output: r.parsed,
      model_reasoning: r.reasoning,
      correction: answer.trim(),
    });
    console.log("  Noted.");
  }
  console.log("");
}

rl.close();

// Update state
const editCount = corrections.length;
const wasClean = editCount === 0;

if (wasClean) {
  icpState.clean_rounds++;
  console.log("Batch " + batchNum + " CLEAN. Clean rounds: " + icpState.clean_rounds + "/" + CLEAN_ROUNDS_REQUIRED);
} else {
  icpState.clean_rounds = 0;
  console.log("Batch " + batchNum + ": " + editCount + " correction(s). Counter reset to 0.");
}

icpState.total_batches_reviewed++;
icpState.current_batch_offset += BATCH_SIZE;

if (corrections.length > 0) {
  const corrFile = join(EVALS_DIR, "icp-corrections-" + VERSION + "-batch" + batchNum + ".json");
  writeFileSync(corrFile, JSON.stringify({ version: VERSION, batch: batchNum, corrections }, null, 2));
  const nextVersion = "v" + String(parseInt(VERSION.slice(1)) + 1).padStart(3, "0");
  console.log("\\nCorrections -> " + corrFile);
  console.log("Revise prompt for " + nextVersion + " using those corrections, then run:");
  console.log("  bun icp-loop.mjs --version " + nextVersion);
}

if (icpState.clean_rounds >= CLEAN_ROUNDS_REQUIRED) {
  icpState.gate_cleared = true;
  console.log("\\nGATE CLEARED — " + CLEAN_ROUNDS_REQUIRED + " consecutive clean rounds.");
  console.log("Prompt " + VERSION + " is validated. Run full eval:");
  console.log("  bun run-eval.mjs --version " + VERSION);
} else if (wasClean) {
  console.log("\\nNext batch:");
  console.log("  bun icp-loop.mjs --version " + VERSION);
}

// Append summary to corrections_history
icpState.corrections_history.push({
  version: VERSION,
  batch: batchNum,
  edits: editCount,
  clean_after: wasClean,
  timestamp: new Date().toISOString(),
});

writeFileSync(stateFile, JSON.stringify(state, null, 2));
`;

  writeFileSync(join(root, "evals", "icp-loop.mjs"), icpLoopTemplate);
}

// ─── Console output ───────────────────────────────────────────────────────────

console.log("");
console.log("Scenario created: " + name + " (mode: " + mode + ")");
console.log("Location: " + root);
console.log("");
console.log("Next steps:");
console.log("  1. Edit scenario.json — update description and rubric dimensions");
console.log("  2. Add ground truth files to ground-truth/ (12-15 recommended)");
console.log("  3. Paste baseline prompt into prompts/v001.md");

if (mode === "icp-loop") {
  console.log("  4. Run the ICP loop:");
  console.log("       bun " + join("scenarios", name, "evals", "icp-loop.mjs") + " --version v001");
  console.log("");
  console.log("     Review 10 companies, correct any misclassifications.");
  console.log("     Revise the prompt, run again. Gate clears after 3 clean batches.");
  console.log("  5. Once gate is cleared, run full eval:");
  console.log("       bun " + join("scenarios", name, "evals", "run-eval.mjs") + " --version v001");
} else {
  console.log("  4. Run: /anneal-prompt " + name);
  console.log("");
  console.log("Generated scripts:");
  console.log("  evals/run-eval.mjs  — bun run-eval.mjs --version v001");
  console.log("  evals/judge.mjs     — bun judge.mjs --version v001");
}
console.log("");
