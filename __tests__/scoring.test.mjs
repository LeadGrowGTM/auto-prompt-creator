/**
 * Tests for the judge scoring logic in auto-prompt-creator.
 *
 * The judge's core math (score normalization, weighted average, per-split
 * averaging) lives as inline code inside the generated judge.mjs template
 * in setup.mjs. These tests validate that logic by running judge.mjs against
 * known fixtures — black-box through the CLI, same approach as setup.test.mjs.
 *
 * Critical path: if this math is wrong, every graduation decision is wrong.
 *
 * Requires: bun, ANTHROPIC_API_KEY not needed (uses --finalize path only)
 */
import { test, expect, afterAll, beforeAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { join, resolve } from "path";

const REPO = resolve(import.meta.dir, "..");
const SETUP = join(REPO, "setup.mjs");

// ── Helpers ──────────────────────────────────────────────────────────────────

function runSetup(args) {
  const proc = Bun.spawnSync(["bun", SETUP, ...args], { cwd: REPO });
  return { code: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
}

function runJudge(scenarioName, args) {
  const judgeScript = join(REPO, "scenarios", scenarioName, "evals", "judge.mjs");
  const proc = Bun.spawnSync(["bun", judgeScript, ...args], { cwd: REPO });
  return { code: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
}

const scenarioPath = (name) => resolve(REPO, "scenarios", name);
const readJSON = (path) => JSON.parse(readFileSync(path, "utf-8"));

const TEST_SCENARIO = "__scoring_test";
const createdScenarios = [TEST_SCENARIO];

afterAll(() => {
  for (const name of createdScenarios) {
    const dir = scenarioPath(name);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
});

// ── Fixture setup ────────────────────────────────────────────────────────────

/**
 * Build a minimal scenario + raw output file so judge.mjs can run --finalize.
 * Rubric: accuracy (weight 0.60) + tone (weight 0.40). Two inputs: one train, one val.
 */
beforeAll(() => {
  // Create scenario via setup.mjs
  const { code } = runSetup([
    "--name", TEST_SCENARIO,
    "--dimensions", "accuracy:0.60,tone:0.40",
    "--threshold", "0.92",
  ]);
  if (code !== 0) throw new Error("setup.mjs failed for test scenario");

  const base = scenarioPath(TEST_SCENARIO);

  // Write two ground-truth files so run-eval.mjs would have something to read
  // (judge.mjs in template-generation mode reads raw outputs, not GT directly)
  const gt1 = { id: "alpha", split: "train", input: { text: "hello" }, ground_truth: { label: "positive" } };
  const gt2 = { id: "beta", split: "val", input: { text: "world" }, ground_truth: { label: "positive" } };
  writeFileSync(join(base, "ground-truth", "alpha.json"), JSON.stringify(gt1, null, 2));
  writeFileSync(join(base, "ground-truth", "beta.json"), JSON.stringify(gt2, null, 2));

  // Write a synthetic raw output file (mimics what run-eval.mjs produces)
  const rawOutput = {
    prompt_version: "v001",
    timestamp: new Date().toISOString(),
    model: "claude-haiku-4-5-20251001",
    service_tier: "flex",
    estimated_tokens: 120,
    results: [
      { id: "alpha", split: "train", output: { label: "positive" }, raw_response: '{"label":"positive"}', ground_truth: { label: "positive" }, parse_failure: false },
      { id: "beta", split: "val", output: { label: "negative" }, raw_response: '{"label":"negative"}', ground_truth: { label: "positive" }, parse_failure: false },
    ],
    summary: { total: 2, success: 2, failures: 0 },
  };
  writeFileSync(join(base, "evals", "v001-raw.json"), JSON.stringify(rawOutput, null, 2));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("judge.mjs --finalize normalizes scores correctly: (raw - 1) / 4", () => {
  const base = scenarioPath(TEST_SCENARIO);
  const templateFile = join(base, "evals", "v001-scores-template.json");

  // Step 1: generate template
  const genResult = runJudge(TEST_SCENARIO, ["--version", "v001"]);
  expect(genResult.code).toBe(0);
  expect(existsSync(templateFile)).toBe(true);

  // Step 2: fill in known scores: alpha accuracy=5 tone=4, beta accuracy=3 tone=2
  const template = readJSON(templateFile);
  const alphaEntry = template.inputs.find((i) => i.id === "alpha");
  const betaEntry = template.inputs.find((i) => i.id === "beta");
  alphaEntry.scores.accuracy = 5;
  alphaEntry.scores.tone = 4;
  betaEntry.scores.accuracy = 3;
  betaEntry.scores.tone = 2;
  writeFileSync(templateFile, JSON.stringify(template, null, 2));

  // Step 3: finalize
  const finalResult = runJudge(TEST_SCENARIO, ["--version", "v001", "--finalize"]);
  expect(finalResult.code).toBe(0);

  const scored = readJSON(join(base, "evals", "v001.json"));

  // Verify normalization: (5-1)/4 = 1.0, (4-1)/4 = 0.75, (3-1)/4 = 0.5, (2-1)/4 = 0.25
  const alpha = scored.per_input.find((p) => p.input_id === "alpha");
  const beta = scored.per_input.find((p) => p.input_id === "beta");

  expect(alpha.dimensions.accuracy.normalized).toBeCloseTo(1.0, 4);
  expect(alpha.dimensions.tone.normalized).toBeCloseTo(0.75, 4);
  expect(beta.dimensions.accuracy.normalized).toBeCloseTo(0.5, 4);
  expect(beta.dimensions.tone.normalized).toBeCloseTo(0.25, 4);
});

test("judge.mjs --finalize applies rubric weights correctly", () => {
  // Rubric: accuracy=0.60, tone=0.40
  // alpha: accuracy_norm=1.0, tone_norm=0.75 → weighted = 1.0*0.60 + 0.75*0.40 = 0.60 + 0.30 = 0.90
  // beta:  accuracy_norm=0.5, tone_norm=0.25 → weighted = 0.5*0.60 + 0.25*0.40 = 0.30 + 0.10 = 0.40
  const base = scenarioPath(TEST_SCENARIO);
  const scored = readJSON(join(base, "evals", "v001.json"));

  const alpha = scored.per_input.find((p) => p.input_id === "alpha");
  const beta = scored.per_input.find((p) => p.input_id === "beta");

  expect(alpha.weighted_score).toBeCloseTo(0.90, 4);
  expect(beta.weighted_score).toBeCloseTo(0.40, 4);
});

test("judge.mjs --finalize computes correct per-split aggregate scores", () => {
  // train = [alpha: 0.90], val = [beta: 0.40]
  // overall = (0.90 + 0.40) / 2 = 0.65
  const base = scenarioPath(TEST_SCENARIO);
  const scored = readJSON(join(base, "evals", "v001.json"));

  expect(scored.aggregate.train_score).toBeCloseTo(0.90, 4);
  expect(scored.aggregate.validation_score).toBeCloseTo(0.40, 4);
  expect(scored.aggregate.overall_score).toBeCloseTo(0.65, 4);
  // holdout: no holdout inputs in fixture, should be null
  expect(scored.aggregate.holdout_score).toBeNull();
});

test("judge.mjs generates template with correct rubric dimensions", () => {
  // The template's rubric should match the scenario.json dimensions
  const base = scenarioPath(TEST_SCENARIO);
  const templateFile = join(base, "evals", "v001-scores-template.json");
  const template = readJSON(templateFile);

  expect(Object.keys(template.rubric)).toEqual(["accuracy", "tone"]);
  expect(template.instructions).toContain("Score each dimension 1-5");
});
