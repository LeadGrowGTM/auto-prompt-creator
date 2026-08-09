#!/usr/bin/env bun
/**
 * update-loop-state.mjs — Atomic, validated loop-state.json updater.
 *
 * Issue #17: agents were writing loop-state.json directly with no validation
 * or atomicity guarantee. A bad write (partial JSON, wrong version format,
 * missing keys) could corrupt the loop silently.
 *
 * Usage:
 *   bun update-loop-state.mjs --version vNNN
 *   bun update-loop-state.mjs --version vNNN --path path/to/loop-state.json
 *
 * Environment override (used by tests):
 *   LOOP_STATE_FILE=<absolute path>  — overrides --path and default discovery
 *
 * Guarantees:
 *   1. version must match /^v\d{3,}$/ (e.g. v001, v012)
 *   2. Refuses to update if halt_reason is already set
 *   3. Writes atomically: temp file → rename
 *   4. Exits non-zero on any error; leaves file unchanged
 */

import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    version: { type: "string" },
    path: { type: "string" },
  },
});

// ── Validation ────────────────────────────────────────────────────────────────

if (!values.version) {
  console.error("Usage: bun update-loop-state.mjs --version vNNN [--path loop-state.json]");
  process.exit(1);
}

const VERSION_RE = /^v\d{3,}$/;
if (!VERSION_RE.test(values.version)) {
  console.error(
    `Invalid version format: "${values.version}". Must match vNNN (e.g. v001, v012, v100).`
  );
  process.exit(1);
}

// ── Resolve file path ─────────────────────────────────────────────────────────

const stateFile =
  process.env.LOOP_STATE_FILE ||
  (values.path ? resolve(values.path) : null);

if (!stateFile) {
  console.error(
    "No state file specified. Pass --path or set LOOP_STATE_FILE env var."
  );
  process.exit(1);
}

if (!existsSync(stateFile)) {
  console.error(`State file not found: ${stateFile}`);
  process.exit(1);
}

// ── Read and parse current state ──────────────────────────────────────────────

let state;
try {
  state = JSON.parse(readFileSync(stateFile, "utf-8"));
} catch (err) {
  console.error(`Failed to parse ${stateFile}: ${err.message}`);
  process.exit(1);
}

// ── Guard: halt_reason ────────────────────────────────────────────────────────

if (state.halt_reason !== null && state.halt_reason !== undefined) {
  console.error(
    `Loop is already halted (halt_reason: "${state.halt_reason}"). No update applied.`
  );
  process.exit(1);
}

// ── Apply update ──────────────────────────────────────────────────────────────

const iterationNumber = parseInt(values.version.slice(1), 10);

const updated = {
  ...state,
  current_iteration: iterationNumber,
  best_version: values.version,
};

// ── Atomic write: temp file → rename ─────────────────────────────────────────

const tmpFile = stateFile + ".tmp";
try {
  writeFileSync(tmpFile, JSON.stringify(updated, null, 2) + "\n");
  renameSync(tmpFile, stateFile);
} catch (err) {
  console.error(`Atomic write failed: ${err.message}`);
  // Clean up temp file if it exists
  try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch {}
  process.exit(1);
}

console.log(`Updated loop-state: version=${values.version} iteration=${iterationNumber}`);
