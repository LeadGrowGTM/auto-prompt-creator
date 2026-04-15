#!/usr/bin/env bun
/**
 * Contract test: every runner's raw-output record must use the `input_id` key
 * that judge.mjs and compute-scores.py consume.
 *
 * Background: judge.mjs reads r.input_id in ~10 places (lines 105, 112, 140, 141,
 * 149, 156, 158, 231, 236, 254, 255, 257, 260, 271, 274). compute-scores.py reads
 * r["input_id"] in its aggregation loop. The legacy run-v001.mjs / run-vNNN.mjs
 * runners emit `input_id`. If a runner emits `id` instead, every r.input_id
 * resolves to undefined and the judge exits with "Missing scores for undefined".
 *
 * Run: bun tests/test-output-schema.mjs
 * Exit 0 = pass, non-zero = fail.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { strict as assert } from "node:assert";

const repoRoot = resolve(import.meta.dir, "..");
const scenariosDir = join(repoRoot, "scenarios");

const scenarios = readdirSync(scenariosDir).filter((name) =>
  statSync(join(scenariosDir, name)).isDirectory()
);

let failures = 0;

for (const scenario of scenarios) {
  const runEvalPath = join(scenariosDir, scenario, "evals", "run-eval.mjs");
  const src = readFileSync(runEvalPath, "utf8");

  // Locate the results.push({...}) block that defines the raw-output record.
  const pushMatch = src.match(/results\.push\(\s*\{([\s\S]*?)\}\s*\)/);
  assert.ok(pushMatch, `${scenario}/evals/run-eval.mjs: no results.push({...}) block found`);

  const recordBody = pushMatch[1];

  // The record must contain an `input_id:` key. This is the contract that
  // judge.mjs and compute-scores.py depend on.
  const hasInputId = /(^|[\s,{])input_id\s*:/.test(recordBody);
  const hasBareId = /(^|[\s,{])id\s*:/.test(recordBody);

  if (!hasInputId) {
    console.error(
      `FAIL: ${scenario}/evals/run-eval.mjs results.push({...}) is missing \`input_id\` key.`
    );
    if (hasBareId) {
      console.error(
        `      It uses \`id\` instead. judge.mjs reads r.input_id, which resolves to undefined.`
      );
    }
    failures++;
  } else {
    console.log(`PASS: ${scenario}/evals/run-eval.mjs emits input_id`);
  }
}

// Also check the scaffolding template in setup.mjs, so new scenarios don't
// inherit the same bug.
const setupSrc = readFileSync(join(repoRoot, "setup.mjs"), "utf8");
const templateMatch = setupSrc.match(/const\s+runEvalTemplate\s*=\s*`([\s\S]*?)`;/);
if (templateMatch) {
  const template = templateMatch[1];
  const templatePushMatch = template.match(/results\.push\(\s*\{([\s\S]*?)\}\s*\)/);
  if (templatePushMatch) {
    const hasInputId = /(^|[\s,{])input_id\s*:/.test(templatePushMatch[1]);
    if (!hasInputId) {
      console.error(
        `FAIL: setup.mjs runEvalTemplate results.push({...}) is missing \`input_id\` key.`
      );
      failures++;
    } else {
      console.log(`PASS: setup.mjs runEvalTemplate emits input_id`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} contract violation(s).`);
  process.exit(1);
}
console.log(`\nAll raw-output records emit input_id.`);
