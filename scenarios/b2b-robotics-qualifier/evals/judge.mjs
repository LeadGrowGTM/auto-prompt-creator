#!/usr/bin/env bun
/**
 * B2B Robotics Qualifier — Automated Judge
 *
 * Scores raw outputs against ground truth using deterministic rules for 3 dimensions
 * and heuristic scoring for reasoning_quality.
 *
 * Usage:
 *   bun judge.mjs --version v001
 *   bun judge.mjs --version v001 --split holdout
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
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
  console.error("Usage: bun judge.mjs --version vNNN [--split holdout]");
  process.exit(1);
}

const VERSION = args.version;
const BASE = resolve(import.meta.dir, "..");
const suffix = args.split ? `-${args.split}` : "";
const RAW_FILE = join(BASE, "evals", VERSION + suffix + "-raw.json");
const OUT_FILE = join(BASE, "evals", VERSION + suffix + ".json");

const scenarioConfig = JSON.parse(readFileSync(join(BASE, "scenario.json"), "utf-8"));
const rubric = scenarioConfig.rubric.dimensions;

// Load all ground truth files to get descriptions
const GT_DIR = join(BASE, "ground-truth");
const gtMap = {};
for (const f of readdirSync(GT_DIR).filter((f) => f.endsWith(".json"))) {
  const gt = JSON.parse(readFileSync(join(GT_DIR, f), "utf-8"));
  gtMap[gt.id] = gt;
}

const rawData = JSON.parse(readFileSync(RAW_FILE, "utf-8"));
const results = rawData.results;

// Score each result
const scored = [];

for (const r of results) {
  const gt = r.ground_truth;
  const out = r.output;
  const gtFull = gtMap[r.id];
  const description = gtFull?.input?.description || "";

  // If parse failure, all scores are 0
  if (!out || r.parse_failure) {
    scored.push({
      id: r.id,
      domain: r.domain,
      split: r.split,
      weighted_score: 0,
      dimensions: {
        qualified_accuracy: { raw: 1, normalized: 0 },
        score_accuracy: { raw: 1, normalized: 0 },
        b2b_accuracy: { raw: 1, normalized: 0 },
        reasoning_quality: { raw: 1, normalized: 0 },
      },
      output: out,
      ground_truth: gt,
      failure: "parse_failure",
    });
    continue;
  }

  // 1. qualified_accuracy (binary: 5 if match, 1 if not)
  const qualifiedMatch = out.qualified === gt.qualified;
  const qualifiedRaw = qualifiedMatch ? 5 : 1;

  // 2. score_accuracy (5 if exact, 4 if +/-1, 3 if +/-2, 2 if +/-3, 1 if worse)
  const scoreDiff = Math.abs((out.robotics_equipment_score || 0) - gt.robotics_equipment_score);
  let scoreRaw;
  if (scoreDiff === 0) scoreRaw = 5;
  else if (scoreDiff === 1) scoreRaw = 4;
  else if (scoreDiff === 2) scoreRaw = 3;
  else if (scoreDiff === 3) scoreRaw = 2;
  else scoreRaw = 1;

  // 3. b2b_accuracy (binary: 5 if match, 1 if not)
  const b2bMatch = out.is_b2b === gt.is_b2b;
  const b2bRaw = b2bMatch ? 5 : 1;

  // 4. reasoning_quality - does reasoning reference specific details from description?
  let reasoningRaw = 1;
  if (out.reasoning && typeof out.reasoning === "string") {
    const reasoning = out.reasoning.toLowerCase();

    if (reasoning.length < 15 || /^n\/a|not applicable/i.test(reasoning)) {
      reasoningRaw = 1;
    } else if (reasoning.length < 30) {
      reasoningRaw = 2;
    } else {
      // Base score 3 for adequate reasoning
      reasoningRaw = 3;

      // Extract distinctive words from description (5+ chars, not generic)
      const stopWords = new Set([
        "company","provides","offers","solutions","services","business",
        "various","industries","including","features","include","through",
        "designed","across","management","operations","systems","support",
        "integration","technology","platform","automated","automation",
        "warehouse","robotic","robotics","their","which","other","about",
        "based","using","these","being","process","specific","customers",
        "products","product","between","custom","existing","allowing",
        "ensure","ability","advanced","enhancing","enhance","along",
        "focused","focusing","without","operational","streamlining",
      ]);

      const descTerms = new Set(
        description.toLowerCase().match(/\b[a-z]{5,}\b/g)?.filter((w) => !stopWords.has(w)) || []
      );

      let matchCount = 0;
      for (const term of descTerms) {
        if (reasoning.includes(term)) matchCount++;
      }

      // Does reasoning explain the why (not just restate)?
      const explainsWhy = /because|since|primarily|rather than|not.*sell|does not|focus|although|despite|while|however|instead/i.test(reasoning);

      // Does reasoning use domain-relevant categories?
      const usesCategories = /hardware|physical|equipment|software|saas|rpa|consult|maintenance|integrat|deploy|assembl|install|manufacturer|component|sensor/i.test(reasoning);

      if (matchCount >= 1 && explainsWhy) reasoningRaw = 4;
      if (matchCount >= 1 && usesCategories) reasoningRaw = Math.max(reasoningRaw, 4);
      if (matchCount >= 2 && explainsWhy && usesCategories) reasoningRaw = 5;
      if (explainsWhy && usesCategories && reasoning.length >= 60) reasoningRaw = Math.max(reasoningRaw, 4);
    }
  }

  // Compute weighted score
  const dims = {
    qualified_accuracy: { raw: qualifiedRaw, normalized: (qualifiedRaw - 1) / 4 },
    score_accuracy: { raw: scoreRaw, normalized: (scoreRaw - 1) / 4 },
    b2b_accuracy: { raw: b2bRaw, normalized: (b2bRaw - 1) / 4 },
    reasoning_quality: { raw: reasoningRaw, normalized: (reasoningRaw - 1) / 4 },
  };

  let weightedScore = 0;
  for (const [dim, config] of Object.entries(rubric)) {
    weightedScore += dims[dim].normalized * config.weight;
  }
  weightedScore = Math.round(weightedScore * 10000) / 10000;

  scored.push({
    id: r.id,
    domain: r.domain,
    split: r.split,
    weighted_score: weightedScore,
    dimensions: dims,
    output: out,
    ground_truth: gt,
  });
}

// Compute aggregates
const avg = (arr) =>
  arr.length
    ? Math.round((arr.reduce((s, x) => s + x.weighted_score, 0) / arr.length) * 10000) / 10000
    : null;

const train = scored.filter((s) => s.split === "train");
const val = scored.filter((s) => s.split === "val");
const holdout = scored.filter((s) => s.split === "holdout");
const all = scored;

const dimAvgs = {};
for (const dim of Object.keys(rubric)) {
  dimAvgs[dim] = Math.round(
    (all.reduce((s, x) => s + x.dimensions[dim].normalized, 0) / all.length) * 10000
  ) / 10000;
}

const output = {
  prompt_version: VERSION,
  timestamp: new Date().toISOString(),
  model: "gpt-4.1-mini",
  estimated_tokens: rawData.estimated_tokens,
  aggregate: {
    overall: avg(all),
    train: avg(train),
    val: avg(val),
    holdout: avg(holdout),
    dimension_averages: dimAvgs,
  },
  per_input: scored,
};

writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

console.log(`\n=== ${VERSION}${suffix} Scores ===`);
console.log(`Overall: ${output.aggregate.overall}`);
console.log(`Train:   ${output.aggregate.train}`);
console.log(`Val:     ${output.aggregate.val}`);
if (output.aggregate.holdout) console.log(`Holdout: ${output.aggregate.holdout}`);
console.log(`\nDimension averages:`);
for (const [dim, val2] of Object.entries(dimAvgs)) {
  console.log(`  ${dim}: ${val2}`);
}

// Show failures
const failures = scored.filter((s) => s.weighted_score < 0.80);
if (failures.length > 0) {
  console.log(`\n${failures.length} items below 0.80:`);
  for (const f of failures) {
    const outQ = f.output ? `q=${f.output.qualified}` : "PARSE_FAIL";
    const outS = f.output ? `s=${f.output.robotics_equipment_score}` : "";
    const gtQ = `q=${f.ground_truth.qualified}`;
    const gtS = `s=${f.ground_truth.robotics_equipment_score}`;
    console.log(
      `  [${f.id}] ${f.domain} (${f.split}) score=${f.weighted_score} | output: ${outQ} ${outS} | expected: ${gtQ} ${gtS}`
    );
  }
}
