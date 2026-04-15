#!/usr/bin/env bun
/**
 * Auto Prompt Creator — Scenario Setup
 *
 * Scaffolds a new scenario directory with all required files.
 *
 * Usage:
 *   bun setup.mjs --name my-scenario
 *   bun setup.mjs --name my-scenario --dimensions "accuracy:0.5,format:0.3,style:0.2"
 *   bun setup.mjs --name my-scenario --threshold 0.90 --budget 600
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
  },
});

if (!values.name) {
  console.error("Usage: bun setup.mjs --name <scenario-name>");
  console.error("Options:");
  console.error('  --description "What this prompt does"');
  console.error('  --dimensions "accuracy:0.5,format:0.3,style:0.2"');
  console.error("  --threshold 0.92");
  console.error("  --budget 800");
  console.error("  --iterations 10");
  process.exit(1);
}

const name = values.name;
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
  model: "claude-haiku",
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
};

writeFileSync(join(root, "evals", "loop-state.json"), JSON.stringify(loopState, null, 2) + "\n");

// Write placeholder v001.md to prompts/ (not evals/)
writeFileSync(
  join(root, "prompts", "v001.md"),
  "[TODO] Paste your baseline prompt here.\n\nThis is the starting point for optimization.\n"
);

// Write example input template (generic, not B2B-specific)
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

// Write parameterized run-eval.mjs
const runEvalTemplate = `#!/usr/bin/env bun
/**
 * Parameterized eval runner for ${name}
 *
 * Usage: bun run-eval.mjs --version v001
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { parseArgs } from "util";
import { $ } from "bun";

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: { version: { type: "string" } },
});

if (!args.version) {
  console.error("Usage: bun run-eval.mjs --version vNNN");
  process.exit(1);
}

const version = args.version;
const scenarioDir = resolve(import.meta.dir, "..");
const evalsDir = import.meta.dir;
const promptFile = join(scenarioDir, "prompts", version + ".md");
const gtDir = join(scenarioDir, "ground-truth");
const outFile = join(evalsDir, version + "-raw.json");

// Read prompt
const promptTemplate = readFileSync(promptFile, "utf-8");

// Read ground truth files for inputs
const gtFiles = readdirSync(gtDir).filter((f) => f.endsWith(".json")).sort();
const results = [];

for (const file of gtFiles) {
  const gt = JSON.parse(readFileSync(join(gtDir, file), "utf-8"));
  const input = gt.input;
  const id = gt.id || file.replace(".json", "");

  // [TODO] Customize this line for your scenario's input format
  const fullPrompt = promptTemplate + "\\n\\n" + JSON.stringify(input, null, 2);

  // Write prompt to temp file to avoid shell escaping issues
  const tmpFile = join(evalsDir, ".tmp-prompt.txt");
  writeFileSync(tmpFile, fullPrompt);

  console.log("Running " + id + "...");

  try {
    const result = await $\`cat \${tmpFile} | claude --print --model haiku --allowedTools ""\`.text();
    results.push({
      input_id: id,
      company: input.company_name || input.name || id,
      split: gt.split || "train",
      output: result.trim(),
      tokens: promptTemplate.length,
      groundTruth: gt.ground_truth,
    });
    console.log("  Done: " + result.trim().substring(0, 80));
  } catch (err) {
    console.error("  FAILED: " + err.message);
    results.push({ input_id: id, company: input.company_name || id, split: gt.split || "train", output: "ERROR", tokens: 0, groundTruth: gt.ground_truth });
  }
}

// Clean up temp file
try { require("fs").unlinkSync(join(evalsDir, ".tmp-prompt.txt")); } catch {}

writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log("\\nWrote " + results.length + " results to " + outFile);
console.log("Passed: " + results.filter((r) => r.output !== "ERROR").length + "/" + results.length);
`;

writeFileSync(join(root, "evals", "run-eval.mjs"), runEvalTemplate);

// Write parameterized judge.mjs
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

// Read raw outputs
const rawOutputs = JSON.parse(readFileSync(rawFile, "utf-8"));

if (args.finalize) {
  // Read filled template and compute final scores
  if (!existsSync(templateFile)) {
    console.error("No score template found at " + templateFile);
    console.error("Run without --finalize first to generate the template.");
    process.exit(1);
  }

  const template = JSON.parse(readFileSync(templateFile, "utf-8"));
  const perInput = [];

  for (const entry of template.inputs) {
    const dimensions = {};
    let weightedSum = 0;

    for (const [dim, config] of Object.entries(rubric)) {
      const raw = entry.scores[dim];
      if (raw === null || raw === undefined) {
        console.error("Missing score for " + entry.id + " dimension " + dim);
        process.exit(1);
      }
      const normalized = (raw - 1) / 4;
      dimensions[dim] = { raw, normalized };
      weightedSum += normalized * config.weight;
    }

    perInput.push({
      input_id: entry.id,
      split: entry.split,
      weighted_score: Math.round(weightedSum * 10000) / 10000,
      dimensions,
    });
  }

  // Compute aggregates
  const train = perInput.filter((p) => p.split === "train");
  const val = perInput.filter((p) => p.split === "val");
  const holdout = perInput.filter((p) => p.split === "holdout");
  const avg = (arr) => arr.length ? arr.reduce((s, p) => s + p.weighted_score, 0) / arr.length : null;

  const dimAverages = {};
  for (const dim of Object.keys(rubric)) {
    dimAverages[dim] = Math.round(
      perInput.reduce((s, p) => s + p.dimensions[dim].normalized, 0) / perInput.length * 10000
    ) / 10000;
  }

  const output = {
    prompt_version: version,
    timestamp: new Date().toISOString(),
    config: { target_model: "haiku", judge: "manual", normalization: "(score - 1) / 4" },
    aggregate: {
      overall_score: Math.round(avg(perInput) * 10000) / 10000,
      train_score: Math.round(avg(train) * 10000) / 10000,
      validation_score: val.length ? Math.round(avg(val) * 10000) / 10000 : null,
      holdout_score: holdout.length ? Math.round(avg(holdout) * 10000) / 10000 : null,
      dimension_averages: dimAverages,
    },
    per_input: perInput,
  };

  writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log("Wrote scored results to " + outFile);
  console.log("Overall: " + output.aggregate.overall_score);
  console.log("Train: " + output.aggregate.train_score);
  console.log("Val: " + output.aggregate.validation_score);
  if (output.aggregate.holdout_score) console.log("Holdout: " + output.aggregate.holdout_score);

} else {
  // Generate score template for manual review
  const semanticDims = Object.keys(rubric).filter((d) => d !== "format_comp" && d !== "format_compliance");

  const inputs = rawOutputs.map((raw) => ({
    id: raw.id,
    split: raw.split,
    haiku_output: raw.output,
    ground_truth: raw.groundTruth,
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

// Count ground truth files for validation warning
const gtCount = 1; // Just the example file
if (gtCount < 12) {
  console.log("Warning: Minimum 12 ground truth files recommended (currently: example only).");
  console.log("Add at least 12 real test cases before running the anneal loop.");
  console.log("");
}

console.log("Scenario created: " + name);
console.log("Location: " + root);
console.log("");
console.log("Next steps:");
console.log("  1. Edit scenario.json - update description and rubric dimensions");
console.log("  2. Add input files to inputs/ (12-15 recommended, delete example.json)");
console.log("  3. Add ground truth to ground-truth/ (set split: train/val/holdout)");
console.log("  4. Paste your baseline prompt into prompts/v001.md");
console.log("  5. Run: /anneal-prompt " + name);
console.log("");
console.log("Generated scripts:");
console.log("  evals/run-eval.mjs  -- bun run-eval.mjs --version v001");
console.log("  evals/judge.mjs     -- bun judge.mjs --version v001");
console.log("");
