#!/usr/bin/env bun
/**
 * judge.mjs - Semi-automated scoring for prospect-identification scenario.
 *
 * Modes:
 *   bun judge.mjs --version v001              # manual: emit score template
 *   bun judge.mjs --version v001 --finalize   # combine filled template + format scores -> vNNN.json
 *   bun judge.mjs --version v001 --auto       # opus-auto: 3x median scoring via claude CLI -> vNNN.json
 */
import { parseArgs } from "util";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";

const { values: flags } = parseArgs({
  options: {
    version:  { type: "string", short: "v" },
    auto:     { type: "boolean", default: false },
    finalize: { type: "boolean", default: false },
  },
  strict: true,
});

if (!flags.version) {
  console.error("Usage: bun judge.mjs --version vNNN [--auto | --finalize]");
  process.exit(1);
}

const ver = flags.version;
const BASE = dirname(dirname(import.meta.path));  // scenarios/prospect-identification
const EVALS = join(BASE, "evals");
const GT_DIR = join(BASE, "ground-truth");
const RAW_FILE = join(EVALS, `${ver}-raw.json`);
const SCENARIO_FILE = join(BASE, "scenario.json");
const TEMPLATE_FILE = join(EVALS, `${ver}-scores-template.json`);
const OUT_FILE = join(EVALS, `${ver}.json`);

// --- Load data ---
function loadJSON(path) {
  if (!existsSync(path)) { console.error(`Missing: ${path}`); process.exit(1); }
  return JSON.parse(readFileSync(path, "utf8"));
}

const raw = loadJSON(RAW_FILE);
const scenario = loadJSON(SCENARIO_FILE);

// Load ground truth per input
function loadGroundTruth() {
  const gt = {};
  for (const file of readdirSync(GT_DIR).filter(f => f.endsWith(".json"))) {
    const data = loadJSON(join(GT_DIR, file));
    gt[data.id] = data;
  }
  return gt;
}

const groundTruth = loadGroundTruth();
const weights = {};
const semanticDims = [];
for (const [dim, cfg] of Object.entries(scenario.rubric.dimensions)) {
  weights[dim] = cfg.weight;
  if (dim !== "format_compliance") semanticDims.push(dim);
}

// --- Format compliance (programmatic) ---
function checkFormatCompliance(output) {
  const failures = [];
  const btWords = (output.businessTypes || "").split(/\s+/).length;
  const dmWords = (output.decisionMakers || "").split(/\s+/).length;

  if (btWords > 7) failures.push(`businessTypes has ${btWords} words (max 7)`);
  if (dmWords > 6) failures.push(`decisionMakers has ${dmWords} words (max 6)`);

  for (const [field, val] of Object.entries(output)) {
    if (typeof val !== "string") continue;
    if (!val.includes(" and ")) failures.push(`${field} missing 'and' separator`);

    // Lowercase check: allow all-caps acronyms (2-4 chars) and "I" in proper nouns
    const words = val.split(/\s+/);
    for (const w of words) {
      if (/^[A-Z]{2,4}s?$/.test(w)) continue;  // acronyms like CTOs, OEMs
      if (w !== w.toLowerCase()) {
        failures.push(`${field} has unexpected capitals: '${val}'`);
        break;
      }
    }

    // Plural check for decisionMakers
    if (field === "decisionMakers") {
      const parts = val.split(/\s+and\s+/);
      for (const part of parts) {
        const lastWord = part.trim().split(/\s+/).pop();
        if (lastWord && !lastWord.endsWith("s")) {
          failures.push(`decisionMakers part '${part.trim()}' may not be plural`);
        }
      }
    }
  }

  // Score: 5 = no failures, 4 = 1 failure, 3 = 2, 2 = 3, 1 = 4+
  const score = Math.max(1, 5 - failures.length);
  return { score, failures };
}

// --- Manual mode: emit template ---
function emitTemplate() {
  const inputs = raw.results.map(r => {
    const gt = groundTruth[r.input_id];
    const scores = {};
    for (const dim of semanticDims) scores[dim] = null;
    return {
      id: r.input_id,
      split: r.split,
      haiku_output: r.haiku_output,
      ground_truth: gt?.ground_truth || gt?.expected_output || {},
      scores,
    };
  });

  const template = {
    prompt_version: ver,
    instructions: "Score each dimension 1-5. 1=completely wrong, 5=exact match to ground truth.",
    inputs,
  };

  writeFileSync(TEMPLATE_FILE, JSON.stringify(template, null, 2));
  console.log(`\nWrote: ${TEMPLATE_FILE}`);
  console.log(`\nFill in scores 1-5 in ${ver}-scores-template.json, then re-run with --finalize`);
}

// --- Finalize: combine template scores + format compliance -> vNNN.json ---
function finalize(semanticScores) {
  // semanticScores: Map<inputId, { dim: rawScore }>
  const perInput = [];
  const dimTotals = {};
  for (const dim of Object.keys(weights)) dimTotals[dim] = 0;

  for (const r of raw.results) {
    const fmt = checkFormatCompliance(r.haiku_output);
    const scores = semanticScores.get(r.input_id);
    if (!scores) { console.error(`Missing scores for ${r.input_id}`); process.exit(1); }

    const dimensions = {};
    let weightedScore = 0;

    for (const dim of Object.keys(weights)) {
      const rawScore = dim === "format_compliance" ? fmt.score : scores[dim];
      if (rawScore == null) { console.error(`Missing score ${dim} for ${r.input_id}`); process.exit(1); }
      const normalized = (rawScore - 1) / 4;
      dimensions[dim] = { score: rawScore, normalized: round4(normalized) };
      weightedScore += normalized * weights[dim];
      dimTotals[dim] += normalized;
    }

    const gt = groundTruth[r.input_id];
    perInput.push({
      input_id: r.input_id,
      split: r.split,
      weighted_score: round4(weightedScore),
      dimensions,
      haiku_output: r.haiku_output,
      ground_truth: gt?.ground_truth || gt?.expected_output || {},
      format_compliance_failures: fmt.failures,
    });
  }

  const n = perInput.length;
  const trainScores = perInput.filter(p => p.split === "train").map(p => p.weighted_score);
  const valScores = perInput.filter(p => p.split === "validation" || p.split === "val").map(p => p.weighted_score);
  const holdoutScores = perInput.filter(p => p.split === "holdout").map(p => p.weighted_score);
  const allScores = perInput.map(p => p.weighted_score);

  const avg = arr => arr.length ? round4(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const aggregate = {
    overall_score: avg(allScores),
    train_score: avg(trainScores),
    validation_score: avg(valScores),
    dimension_averages: {},
  };
  if (holdoutScores.length) aggregate.holdout_score = avg(holdoutScores);

  for (const dim of Object.keys(weights)) {
    aggregate.dimension_averages[dim] = round4(dimTotals[dim] / n);
  }

  const result = {
    prompt_version: ver,
    timestamp: new Date().toISOString(),
    config: {
      target_model: "haiku",
      judge: semanticScores._judge || "manual",
      normalization: "(score - 1) / 4",
    },
    aggregate,
    per_input: perInput,
  };

  writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\nWrote: ${OUT_FILE}`);
  console.log(`Overall: ${aggregate.overall_score}, Train: ${aggregate.train_score}, Val: ${aggregate.validation_score}`);
  console.log("Dimension averages:", aggregate.dimension_averages);
}

// --- Finalize from template file ---
function finalizeFromTemplate() {
  const template = loadJSON(TEMPLATE_FILE);
  const scores = new Map();
  for (const input of template.inputs) {
    for (const [dim, val] of Object.entries(input.scores)) {
      if (val == null) { console.error(`Unfilled score: ${input.id}.${dim}`); process.exit(1); }
      if (val < 1 || val > 5) { console.error(`Invalid score ${val} for ${input.id}.${dim} (must be 1-5)`); process.exit(1); }
    }
    scores.set(input.id, input.scores);
  }
  scores._judge = "manual";
  finalize(scores);
}

// --- Auto mode: Opus scoring via claude CLI ---
async function autoScore() {
  const { $ } = await import("bun");
  const allRuns = [];  // 3 runs

  for (let run = 0; run < 3; run++) {
    console.log(`\nAuto-judge run ${run + 1}/3...`);
    const runScores = new Map();

    for (const r of raw.results) {
      const gt = groundTruth[r.input_id];
      const gtData = gt?.ground_truth || gt?.expected_output || {};

      const prompt = `You are scoring an LLM output against ground truth for prospect identification.

INPUT ID: ${r.input_id}

HAIKU OUTPUT:
${JSON.stringify(r.haiku_output, null, 2)}

GROUND TRUTH:
${JSON.stringify(gtData, null, 2)}

RUBRIC DIMENSIONS (score each 1-5):
${semanticDims.map(d => `- ${d}: ${scenario.rubric.dimensions[d].description}`).join("\n")}

Respond with ONLY a JSON object, no markdown fences, no explanation:
{${semanticDims.map(d => `"${d}": <1-5>`).join(", ")}}`;

      try {
        const result = await $`claude --print --model opus ${prompt}`.text();
        const cleaned = result.trim().replace(/^```json\s*/, "").replace(/\s*```$/, "");
        const parsed = JSON.parse(cleaned);
        runScores.set(r.input_id, parsed);
        process.stdout.write(`  ${r.input_id}: ${JSON.stringify(parsed)}\n`);
      } catch (err) {
        console.error(`  Failed for ${r.input_id}: ${err.message}`);
        // Fallback: score 3 for all dims
        const fallback = {};
        for (const d of semanticDims) fallback[d] = 3;
        runScores.set(r.input_id, fallback);
      }
    }
    allRuns.push(runScores);
  }

  // Take median across 3 runs per dimension per input
  const medianScores = new Map();
  for (const r of raw.results) {
    const median = {};
    for (const dim of semanticDims) {
      const vals = allRuns.map(run => run.get(r.input_id)?.[dim] || 3).sort((a, b) => a - b);
      median[dim] = vals[1];  // median of 3
    }
    medianScores.set(r.input_id, median);
  }
  medianScores._judge = "opus-auto";
  finalize(medianScores);
}

function round4(n) { return Math.round(n * 10000) / 10000; }

// --- Main ---
if (flags.auto) {
  await autoScore();
} else if (flags.finalize) {
  finalizeFromTemplate();
} else {
  emitTemplate();
}
