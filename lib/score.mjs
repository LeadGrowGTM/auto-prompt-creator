/**
 * lib/score.mjs — Extracted scoring math for the anneal loop judge.
 *
 * Pure functions with no I/O. Importable by judge.mjs templates and tests.
 * Issue #16: these were previously inlined in setup.mjs's judge template,
 * making them untestable.
 */

/**
 * Normalize a 1-5 raw score to a 0-1 float.
 * Formula: (raw - 1) / 4
 *
 * @param {number} raw - integer 1-5
 * @returns {number} float in [0, 1]
 */
export function normalizeScore(raw) {
  return (raw - 1) / 4;
}

/**
 * Compute a weighted sum of already-normalized dimension scores.
 *
 * @param {Record<string, number>} normalizedDims - { dimName: normalizedValue }
 * @param {Record<string, number>} weights        - { dimName: weight } (should sum to 1.0)
 * @returns {number} weighted score
 */
export function weightedScore(normalizedDims, weights) {
  let sum = 0;
  for (const [dim, value] of Object.entries(normalizedDims)) {
    sum += value * (weights[dim] ?? 0);
  }
  return sum;
}

/**
 * Aggregate per-input scores into overall, train, val, and holdout averages.
 * Rounds each result to 4 decimal places.
 *
 * @param {Array<{ split: string, weighted_score: number }>} perInput
 * @returns {{ overall_score: number, train_score: number|null, validation_score: number|null, holdout_score: number|null }}
 */
export function aggregateScores(perInput) {
  const avg = (arr) => {
    if (!arr.length) return null;
    const sum = arr.reduce((s, p) => s + p.weighted_score, 0);
    return Math.round((sum / arr.length) * 10000) / 10000;
  };

  const train   = perInput.filter((p) => p.split === "train");
  const val     = perInput.filter((p) => p.split === "val");
  const holdout = perInput.filter((p) => p.split === "holdout");

  return {
    overall_score:    avg(perInput),
    train_score:      avg(train),
    validation_score: val.length     ? avg(val)     : null,
    holdout_score:    holdout.length ? avg(holdout) : null,
  };
}
