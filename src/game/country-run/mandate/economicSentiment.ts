import type { EconomicSnapshot } from './economicSnapshots.ts'

/**
 * M5 §19: "economic sentiment/memory — recent-trend-weighted; 8% falling
 * quickly perceived better than 7.5% rising." Deliberately trend-based, not
 * level-based: this reads the last few turns' MOVEMENT on a handful of
 * core indicators, weighting the most recent movement most heavily, and
 * turns that into a small signed delta feeding `popularityV2`'s
 * `economicTrendDelta`. A bad-but-improving economy nets positive; a
 * good-but-worsening one nets negative — regardless of the raw level.
 */
const TREND_WINDOW = 3
const UNEMPLOYMENT_SENSITIVITY = 1.2
const GROWTH_SENSITIVITY = 0.6
const PURCHASING_POWER_SENSITIVITY = 0.5
const MAX_SENTIMENT_DELTA = 2

/** Weights later differences more heavily than earlier ones — "recent-trend-weighted". */
function recencyWeightedSlope(values: readonly number[]): number {
  if (values.length < 2) return 0
  let weightedSum = 0
  let weightTotal = 0
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    const weight = i
    weightedSum += diff * weight
    weightTotal += weight
  }
  return weightTotal === 0 ? 0 : weightedSum / weightTotal
}

/**
 * `history` must already include the current turn's snapshot as its last
 * entry. Returns 0 with fewer than 2 snapshots (nothing to trend on yet —
 * turn 1 has no prior turn to compare against).
 */
export function computeEconomicSentimentDelta(history: readonly EconomicSnapshot[]): number {
  const window = history.slice(-TREND_WINDOW)
  if (window.length < 2) return 0

  const unemploymentSlope = recencyWeightedSlope(window.map((s) => s.unemployment))
  const growthSlope = recencyWeightedSlope(window.map((s) => s.growth))
  const purchasingPowerSlope = recencyWeightedSlope(window.map((s) => s.purchasingPower))

  // Unemployment: lower is better, so a falling (negative) slope contributes positively.
  const raw =
    -unemploymentSlope * UNEMPLOYMENT_SENSITIVITY + growthSlope * GROWTH_SENSITIVITY + purchasingPowerSlope * PURCHASING_POWER_SENSITIVITY

  return Math.max(-MAX_SENTIMENT_DELTA, Math.min(MAX_SENTIMENT_DELTA, raw))
}
