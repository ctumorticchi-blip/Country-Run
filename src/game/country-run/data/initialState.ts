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

const PLACEHOLDER_ECONOMIC_STATE = {
  gdp: 2800, // Md€, placeholder order of magnitude only
  nominalGdp: 2800, // Md€, placeholder — equal to real GDP at t=0 (index base)
  potentialGrowth: 1.2, // %/year, placeholder
  growth: 1.1, // %/year, placeholder
  inflation: 2.0, // %/year, placeholder

  unemployment: 7.5, // %, placeholder
  structuralUnemployment: 7.0, // %, placeholder

  publicRevenue: 1350, // Md€/year run-rate, placeholder
  publicSpending: 1500, // Md€/year run-rate, placeholder (includes interestCost below)
  fiscalBalance: -150, // Md€/year, placeholder (publicRevenue - publicSpending)
  deficit: 150, // Md€/year, placeholder (max(0, -fiscalBalance))
  deficitRatio: 5.4, // % of nominal GDP, placeholder

  debt: 3200, // Md€, placeholder
  debtRatio: 114.3, // % of nominal GDP, placeholder

  effectiveDebtRate: 2.2, // %/year blended rate on the debt stock, placeholder
  interestCost: 70, // Md€/year, placeholder (effectiveDebtRate% × debt)

  purchasingPower: 0, // cumulative index, 0 = baseline at game start, placeholder

  productivityGrowth: 0.8, // %/year, placeholder

  consumerConfidence: 50, // index 0-100, placeholder (neutral)
  businessConfidence: 50, // index 0-100, placeholder (neutral)
  marketConfidence: 55, // index 0-100, placeholder

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
