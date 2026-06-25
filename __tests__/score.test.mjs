/**
 * Tests for lib/score.mjs — extracted scoring math.
 *
 * Issue #16: scoring logic was embedded in setup.mjs (inside the judge.mjs
 * template string), making it impossible to unit-test independently. The fix
 * extracts the pure math to lib/score.mjs so it can be imported directly.
 *
 * These tests validate:
 *   - normalizeScore(raw) → (raw - 1) / 4
 *   - weightedScore(normalizedDims, weights) → weighted sum
 *   - aggregateScores(perInput) → { overall, train, val, holdout }
 */
import { test, expect } from "bun:test";
import { normalizeScore, weightedScore, aggregateScores } from "../lib/score.mjs";

// ── normalizeScore ────────────────────────────────────────────────────────────

test("normalizeScore: 1 → 0.0", () => {
  expect(normalizeScore(1)).toBeCloseTo(0.0, 6);
});

test("normalizeScore: 5 → 1.0", () => {
  expect(normalizeScore(5)).toBeCloseTo(1.0, 6);
});

test("normalizeScore: 3 → 0.5", () => {
  expect(normalizeScore(3)).toBeCloseTo(0.5, 6);
});

test("normalizeScore: 2 → 0.25", () => {
  expect(normalizeScore(2)).toBeCloseTo(0.25, 6);
});

test("normalizeScore: 4 → 0.75", () => {
  expect(normalizeScore(4)).toBeCloseTo(0.75, 6);
});

// ── weightedScore ─────────────────────────────────────────────────────────────

test("weightedScore: accuracy=1.0 weight=0.6, tone=0.75 weight=0.4 → 0.90", () => {
  const result = weightedScore(
    { accuracy: 1.0, tone: 0.75 },
    { accuracy: 0.6, tone: 0.4 }
  );
  expect(result).toBeCloseTo(0.9, 4);
});

test("weightedScore: accuracy=0.5 weight=0.6, tone=0.25 weight=0.4 → 0.40", () => {
  const result = weightedScore(
    { accuracy: 0.5, tone: 0.25 },
    { accuracy: 0.6, tone: 0.4 }
  );
  expect(result).toBeCloseTo(0.4, 4);
});

test("weightedScore: single dimension with weight 1.0 passes through normalized value", () => {
  const result = weightedScore({ accuracy: 0.75 }, { accuracy: 1.0 });
  expect(result).toBeCloseTo(0.75, 4);
});

// ── aggregateScores ───────────────────────────────────────────────────────────

test("aggregateScores: computes overall, train, and val correctly", () => {
  const perInput = [
    { split: "train", weighted_score: 0.9 },
    { split: "val",   weighted_score: 0.4 },
  ];
  const result = aggregateScores(perInput);
  expect(result.train_score).toBeCloseTo(0.9, 4);
  expect(result.validation_score).toBeCloseTo(0.4, 4);
  expect(result.overall_score).toBeCloseTo(0.65, 4);
  expect(result.holdout_score).toBeNull();
});

test("aggregateScores: holdout_score is null when no holdout inputs", () => {
  const perInput = [
    { split: "train", weighted_score: 0.8 },
  ];
  const result = aggregateScores(perInput);
  expect(result.holdout_score).toBeNull();
});

test("aggregateScores: holdout_score populated when holdout inputs present", () => {
  const perInput = [
    { split: "train",   weighted_score: 0.8 },
    { split: "holdout", weighted_score: 0.7 },
  ];
  const result = aggregateScores(perInput);
  expect(result.holdout_score).toBeCloseTo(0.7, 4);
});

test("aggregateScores: rounds to 4 decimal places", () => {
  const perInput = [
    { split: "train", weighted_score: 1 / 3 },
    { split: "train", weighted_score: 2 / 3 },
  ];
  const result = aggregateScores(perInput);
  // (1/3 + 2/3) / 2 = 0.5 exactly
  expect(result.train_score).toBe(0.5);
  expect(result.overall_score).toBe(0.5);
});
