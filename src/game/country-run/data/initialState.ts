import type { GameState, Seed } from '../../../engine/state/gameState.ts'

/**
 * ⚠️ PLACEHOLDER DATASET — NOT REAL DATA.
 *
 * These starting values are fictional development placeholders picked to be
 * "roughly plausible" for a French-like economy, so the debug shell has
 * something sensible to display. They are NOT the official France 2027
 * dataset described in the Product Bible (§19, "Données et garde-fous"),
 * which requires each figure to be documented with value, period,
 * definition, source, retrieval date, and status (observed / forecast /
 * game hypothesis).
 *
 * Replace this file's numbers with the sourced dataset before any content
 * or economic-engine work begins (M1+). Do not present these numbers to
 * players as real.
 */
const PLACEHOLDER_STARTING_YEAR = 2027
const PLACEHOLDER_STARTING_MONTH = 1

/**
 * Approximate France-2027 CALIBRATION REFERENCE (M1.5): growth ≈ 0.9%,
 * inflation ≈ 1.7%, unemployment ≈ 8.1%, deficitRatio ≈ 5%, debtRatio ≈
 * 120%. These are calibration targets used to pick plausible starting
 * magnitudes for the gameplay model — NOT the sourced, official France
 * 2027 dataset (still a separate future milestone; see the file-level
 * warning above).
 */
const PLACEHOLDER_ECONOMIC_STATE = {
  gdp: 2800, // Md€, placeholder order of magnitude only
  nominalGdp: 2800, // Md€, placeholder — equal to real GDP at t=0 (index base)
  potentialGrowth: 0.9, // %/year, placeholder — matches the growth calibration reference
  growth: 0.9, // %/year, placeholder — starts at potential (no cyclical gap)
  inflation: 1.7, // %/year, placeholder — matches the inflation calibration reference

  unemployment: 8.1, // %, placeholder — matches the unemployment calibration reference
  structuralUnemployment: 8.1, // %, placeholder — starts equal to unemployment (no cyclical gap)

  publicRevenue: 1372, // Md€/year run-rate, placeholder
  publicSpending: 1512, // Md€/year run-rate, placeholder (includes interestCost below) — deficit = 140 => ~5% of GDP
  fiscalBalance: -140, // Md€/year, placeholder (publicRevenue - publicSpending)
  deficit: 140, // Md€/year, placeholder (max(0, -fiscalBalance))
  deficitRatio: 5.0, // % of nominal GDP, placeholder — matches the deficit calibration reference

  debt: 3360, // Md€, placeholder — 120% of nominal GDP
  debtRatio: 120.0, // % of nominal GDP, placeholder — matches the debt calibration reference

  effectiveDebtRate: 3.0, // %/year blended rate on the debt stock, placeholder — close to ECB rate + baseline spread, so it doesn't lurch on turn 1
  interestCost: 100.8, // Md€/year, placeholder (effectiveDebtRate% × debt)

  purchasingPower: 0, // cumulative index, 0 = baseline at game start, placeholder

  productivityGrowth: 0.83, // %/year, placeholder — chosen so labor + productivity*passthrough ≈ potentialGrowth at turn 1

  consumerConfidence: 50, // index 0-100, placeholder (neutral)
  businessConfidence: 50, // index 0-100, placeholder (neutral)
  marketConfidence: 50, // index 0-100, placeholder (neutral — was 55; a debt/deficit level already near the soft concern thresholds shouldn't start "above neutral")

  publicSectorEfficiency: 55, // index 0-100, placeholder
} satisfies GameState['economic']

const PLACEHOLDER_POLITICAL_STATE = {
  popularity: 50, // %, placeholder
  parliamentSeats: 289, // seats held by the governing coalition, placeholder
  politicalCredibility: 60, // index 0-100, placeholder
} satisfies GameState['political']

const PLACEHOLDER_SOCIAL_STATE = {
  socialTension: 30, // index 0-100, placeholder
} satisfies GameState['social']

/** Builds a fresh GameState for a new Country Run playthrough. */
export function createInitialGameState(seed: Seed): GameState {
  return {
    meta: {
      seed,
      turn: 0,
      year: PLACEHOLDER_STARTING_YEAR,
      month: PLACEHOLDER_STARTING_MONTH,
      phase: 'setup',
    },
    economic: { ...PLACEHOLDER_ECONOMIC_STATE },
    political: { ...PLACEHOLDER_POLITICAL_STATE },
    social: { ...PLACEHOLDER_SOCIAL_STATE },
    policy: { activePolicies: [] },
    delayedEffects: [],
  }
}
