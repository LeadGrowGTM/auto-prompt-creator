#!/usr/bin/env bun
/**
 * Auto Prompt Creator — Scenario Setup
 *
 * Scaffolds a new scenario directory with all required files.
 *
 * Usage:
 *   bun auto-prompt-creator/setup.mjs --name my-scenario
 *   bun auto-prompt-creator/setup.mjs --name my-scenario --dimensions "accuracy:0.5,format:0.3,style:0.2"
 *   bun auto-prompt-creator/setup.mjs --name my-scenario --threshold 0.90 --budget 600
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
for (const part of values.dimensions.split(",")) {
  const [dimName, weight] = part.split(":");
  dims[dimName.trim()] = {
    weight: parseFloat(weight),
    description: "[TODO] Describe what " + dimName.trim() + " measures",
  };
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

// Write placeholder v001.md
writeFileSync(
  join(root, "evals", "v001.md"),
  "[TODO] Paste your baseline prompt here.\n\nThis is the starting point for optimization.\n"
);

// Write example input template
const exampleInput = {
  company_name: "[TODO] Example Company",
  description: "[TODO] Company description",
};
writeFileSync(join(root, "inputs", "example.json"), JSON.stringify(exampleInput, null, 2) + "\n");

// Write example ground truth template
const exampleGT = {
  id: "example",
  split: "train",
  input: exampleInput,
  ground_truth: {
    field1: "[TODO] Expected output field 1",
    field2: "[TODO] Expected output field 2",
  },
};
writeFileSync(join(root, "ground-truth", "example.json"), JSON.stringify(exampleGT, null, 2) + "\n");

console.log("");
console.log("Scenario created: " + name);
console.log("Location: " + root);
console.log("");
console.log("Next steps:");
console.log("  1. Edit scenario.json - update description and rubric dimensions");
console.log("  2. Add input files to inputs/ (12-15 recommended, delete example.json)");
console.log("  3. Add ground truth to ground-truth/ (set split: train/val/holdout)");
console.log("  4. Paste your baseline prompt into evals/v001.md");
console.log("  5. Run: /anneal-prompt " + name);
console.log("");
