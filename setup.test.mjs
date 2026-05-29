/**
 * Tests for setup.mjs scenario scaffolding — focus: --mode icp-loop contract.
 *
 * Black-box: spawn the real CLI against throwaway scenario names, assert the
 * generated file tree. Verifies behavior through the public interface (the CLI),
 * so it survives any internal refactor of setup.mjs.
 */
import { test, expect, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import { join, resolve } from "path";

const REPO = import.meta.dir;
const SETUP = join(REPO, "setup.mjs");
const createdScenarios = new Set();

// Spawn setup.mjs synchronously; return { code, stdout, stderr }.
function runSetup(args) {
  const proc = Bun.spawnSync(["bun", SETUP, ...args], { cwd: REPO });
  // Track any scenario name we passed so afterAll can clean it up.
  const nameIdx = args.indexOf("--name");
  if (nameIdx !== -1 && args[nameIdx + 1]) createdScenarios.add(args[nameIdx + 1]);
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

const scenarioPath = (name) => resolve(REPO, "scenarios", name);
const readJSON = (name, ...parts) =>
  JSON.parse(readFileSync(join(scenarioPath(name), ...parts), "utf-8"));

afterAll(() => {
  for (const name of createdScenarios) {
    const dir = scenarioPath(name);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
});

// ── Tracer bullet ─────────────────────────────────────────────────────────────
test("icp-loop mode writes icp_loop block into scenario.json", () => {
  const name = "__tdd_icp_block";
  const { code } = runSetup(["--name", name, "--mode", "icp-loop"]);
  expect(code).toBe(0);

  const scenario = readJSON(name, "scenario.json");
  expect(scenario.icp_loop).toEqual({
    enabled: true,
    batch_size: 10,
    clean_rounds_required: 3,
    model: "claude-sonnet-4-6",
    show_reasoning: true,
  });
});

// ── Incremental ─────────────────────────────────────────────────────────────
test("icp-loop mode seeds icp_loop state in loop-state.json", () => {
  const name = "__tdd_icp_state";
  const { code } = runSetup(["--name", name, "--mode", "icp-loop"]);
  expect(code).toBe(0);

  const state = readJSON(name, "evals", "loop-state.json");
  expect(state.icp_loop).toEqual({
    clean_rounds: 0,
    current_batch_offset: 0,
    total_batches_reviewed: 0,
    gate_cleared: false,
    corrections_history: [],
  });
});

test("icp-loop mode generates evals/icp-loop.mjs", () => {
  const name = "__tdd_icp_script";
  const { code } = runSetup(["--name", name, "--mode", "icp-loop"]);
  expect(code).toBe(0);
  expect(existsSync(join(scenarioPath(name), "evals", "icp-loop.mjs"))).toBe(true);
});

test("standard mode omits all icp-loop artifacts", () => {
  const name = "__tdd_standard";
  const { code } = runSetup(["--name", name]); // no --mode → default "standard"
  expect(code).toBe(0);

  const scenario = readJSON(name, "scenario.json");
  expect(scenario.icp_loop).toBeUndefined();

  const state = readJSON(name, "evals", "loop-state.json");
  expect(state.icp_loop).toBeUndefined();

  expect(existsSync(join(scenarioPath(name), "evals", "icp-loop.mjs"))).toBe(false);
});

test("invalid --mode exits non-zero and creates nothing", () => {
  const name = "__tdd_badmode";
  const { code } = runSetup(["--name", name, "--mode", "frobnicate"]);
  expect(code).not.toBe(0);
  expect(existsSync(scenarioPath(name))).toBe(false);
});

test("generated run-eval.mjs uses Anthropic Flex tier", () => {
  const name = "__tdd_flex";
  const { code } = runSetup(["--name", name]);
  expect(code).toBe(0);

  const runEval = readFileSync(join(scenarioPath(name), "evals", "run-eval.mjs"), "utf-8");
  expect(runEval).toContain('service_tier: "flex"');
});

test("existing scenario is not clobbered on a second run", () => {
  const name = "__tdd_noclobber";

  const first = runSetup(["--name", name]);
  expect(first.code).toBe(0);

  // Mutate a generated file, then re-run with the same name.
  const promptFile = join(scenarioPath(name), "prompts", "v001.md");
  writeFileSync(promptFile, "DO NOT OVERWRITE ME");

  const second = runSetup(["--name", name]);
  expect(second.code).not.toBe(0);
  // File untouched → setup refused to overwrite the existing scenario.
  expect(readFileSync(promptFile, "utf-8")).toBe("DO NOT OVERWRITE ME");
});

test("custom --dimensions and --threshold flow into scenario.json", () => {
  const name = "__tdd_custom";
  const { code } = runSetup([
    "--name", name,
    "--dimensions", "accuracy:0.70,tone:0.30",
    "--threshold", "0.85",
  ]);
  expect(code).toBe(0);

  const scenario = readJSON(name, "scenario.json");
  expect(scenario.accuracy_threshold).toBe(0.85);
  expect(Object.keys(scenario.rubric.dimensions)).toEqual(["accuracy", "tone"]);
  expect(scenario.rubric.dimensions.accuracy.weight).toBe(0.70);
  expect(scenario.rubric.dimensions.tone.weight).toBe(0.30);
});
