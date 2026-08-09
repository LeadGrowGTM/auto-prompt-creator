/**
 * Tests for update-loop-state.mjs CLI script.
 *
 * Issue #17: loop-state.json was written directly by agents with no validation
 * or atomic-write guarantee. A bad write (partial JSON, wrong version format,
 * missing required keys) could corrupt the loop state silently.
 *
 * The fix: a dedicated bun update-loop-state.mjs --version vNNN script that:
 *   1. Validates the version format (vNNN)
 *   2. Validates required top-level keys exist in the existing state
 *   3. Writes atomically (write to temp file, rename)
 *   4. Increments current_iteration to match the new version number
 *   5. Exits non-zero and leaves the file unchanged if validation fails
 */
import { test, expect, afterAll, beforeAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { join, resolve } from "path";

const REPO = resolve(import.meta.dir, "..");
const SCRIPT = join(REPO, "update-loop-state.mjs");

// Minimal valid loop-state fixture
const BASE_STATE = {
  scenario: "test-scenario",
  current_iteration: 1,
  best_version: "v001",
  best_validation_score: 0.85,
  last_mutation_type: "additive",
  halt_reason: null,
  config: {
    accuracy_threshold: 0.92,
    max_iterations: 10,
    token_budget: 800,
    overfitting_threshold: 0.12,
  },
  score_history: [],
  consecutive_plateaus: 0,
};

// Temp dir for test fixtures — doesn't touch real scenarios
const FIXTURE_DIR = join(REPO, "temp", "__test_loop_state");
const STATE_FILE = join(FIXTURE_DIR, "loop-state.json");

function runScript(args) {
  const proc = Bun.spawnSync(["bun", SCRIPT, ...args], {
    cwd: REPO,
    env: { ...process.env, LOOP_STATE_FILE: STATE_FILE },
  });
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

function readState() {
  return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
}

function writeState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeState(BASE_STATE);
});

afterAll(() => {
  if (existsSync(FIXTURE_DIR)) rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

// ── existence ─────────────────────────────────────────────────────────────────

test("update-loop-state.mjs script exists at repo root", () => {
  expect(existsSync(SCRIPT)).toBe(true);
});

// ── version format validation ─────────────────────────────────────────────────

test("rejects missing --version flag: exits non-zero", () => {
  const { code } = runScript([]);
  expect(code).not.toBe(0);
});

test("rejects invalid version format 'v1': exits non-zero", () => {
  writeState(BASE_STATE);
  const { code } = runScript(["--version", "v1"]);
  expect(code).not.toBe(0);
});

test("rejects invalid version format '001': exits non-zero (no leading v)", () => {
  writeState(BASE_STATE);
  const { code } = runScript(["--version", "001"]);
  expect(code).not.toBe(0);
});

test("rejects invalid version format 'v00a': exits non-zero", () => {
  writeState(BASE_STATE);
  const { code } = runScript(["--version", "v00a"]);
  expect(code).not.toBe(0);
});

test("accepts valid version format v002: exits zero", () => {
  writeState(BASE_STATE);
  const { code } = runScript(["--version", "v002"]);
  expect(code).toBe(0);
});

// ── state mutation ────────────────────────────────────────────────────────────

test("updates current_iteration to match new version number", () => {
  writeState(BASE_STATE);
  runScript(["--version", "v003"]);
  const state = readState();
  expect(state.current_iteration).toBe(3);
});

test("updates best_version to the new version", () => {
  writeState(BASE_STATE);
  runScript(["--version", "v004"]);
  const state = readState();
  expect(state.best_version).toBe("v004");
});

// ── halt_reason guard ─────────────────────────────────────────────────────────

test("refuses to update if halt_reason is already set: exits non-zero", () => {
  const haltedState = { ...BASE_STATE, halt_reason: "threshold_reached" };
  writeState(haltedState);
  const before = readState();
  const { code } = runScript(["--version", "v002"]);
  expect(code).not.toBe(0);
  // File unchanged
  const after = readState();
  expect(after.current_iteration).toBe(before.current_iteration);
});

// ── file integrity after valid update ────────────────────────────────────────

test("written file is valid JSON after update", () => {
  writeState(BASE_STATE);
  runScript(["--version", "v002"]);
  // readState() throws if JSON is invalid
  expect(() => readState()).not.toThrow();
});

test("preserves all existing keys after update", () => {
  writeState(BASE_STATE);
  runScript(["--version", "v002"]);
  const state = readState();
  expect(state.scenario).toBe("test-scenario");
  expect(state.config).toBeDefined();
  expect(state.score_history).toBeDefined();
  expect(state.consecutive_plateaus).toBeDefined();
});
