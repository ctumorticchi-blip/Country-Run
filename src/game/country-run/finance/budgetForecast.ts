import { advanceEconomicTurn } from '../../../engine/economy/advanceEconomy.ts'
import type { EconomicEngineConfig } from '../../../engine/economy/config/types.ts'
import type { EconomicPolicyInput, WorldState } from '../../../engine/economy/types.ts'
import { TURNS_PER_YEAR } from '../../../engine/state/calendar.ts'
import type { GameState } from '../../../engine/state/gameState.ts'
import { createActionRng } from '../prototype/rng.ts'

/**
 * M6 §32-33: "NOTE DE BERCY"'s forecast engine — PURE (never mutates real
 * game state; every call here operates on the `GameState` handed in and
 * `advanceEconomicTurn` already returns fresh objects, per its own module
 * doc). Runs the real, calibrated M1.5 engine forward one gameplay year (6
 * turns) with the CURRENTLY PROPOSED policy held sustained and no random
 * events, under 3 forecast-only seeds isolated from the real RNG stream —
 * the natural spread across those 3 runs becomes the displayed
 * low/high range. Never a single fake-precise number (M6 §33).
 */
export interface ForecastRange {
  central: number
  low: number
  high: number
}

export interface BudgetForecast {
  growth: ForecastRange
  unemployment: ForecastRange
  inflation: ForecastRange
  deficitRatio: ForecastRange
  debtRatio: ForecastRange
  interestCost: ForecastRange
  purchasingPowerDelta: ForecastRange
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

const FORECAST_SEED_SUFFIXES = ['forecast-a', 'forecast-b', 'forecast-c']

function range(values: number[]): ForecastRange {
  const central = values.reduce((sum, v) => sum + v, 0) / values.length
  return { central, low: Math.min(...values), high: Math.max(...values) }
}

/** Widens a computed [low, high] range symmetrically around its own central value — `widthMultiplier` typically comes from `governmentEffects.ts`'s `fiscalEstimateRangeWidth` (1 = neutral; a government with high `fiscalForecastAccuracy` narrows it, a low one widens it). */
function widen(r: ForecastRange, widthMultiplier: number): ForecastRange {
  const halfSpread = ((r.high - r.low) / 2) * widthMultiplier
  return { central: r.central, low: r.central - halfSpread, high: r.central + halfSpread }
}

function confidenceFromWidthMultiplier(widthMultiplier: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (widthMultiplier <= 0.85) return 'HIGH'
  if (widthMultiplier <= 1.3) return 'MEDIUM'
  return 'LOW'
}

/**
 * Runs the sustained `mergedPolicy` forward exactly one gameplay year (6
 * turns, no events, no further policy changes) from `state`, 3 times under
 * isolated forecast seeds, and reports the resulting spread. `widthMultiplier`
 * additionally widens/narrows the displayed range per government profile
 * (M6 §33: "government profile can modestly affect forecast range width").
 */
export function forecastNextYear(
  state: GameState,
  worldState: WorldState,
  config: EconomicEngineConfig,
  mergedPolicy: EconomicPolicyInput,
  previousMergedPolicy: EconomicPolicyInput,
  seed: string,
  widthMultiplier = 1,
): BudgetForecast {
  const runs = FORECAST_SEED_SUFFIXES.map((suffix) => {
    let current = state
    let previousPolicy = previousMergedPolicy
    for (let i = 0; i < TURNS_PER_YEAR; i++) {
      const rng = createActionRng(`${seed}:${suffix}`, `forecast-turn-${String(current.meta.turn + 1)}`)
      const result = advanceEconomicTurn(current, mergedPolicy, worldState, rng, config, [], previousPolicy)
      previousPolicy = mergedPolicy
      current = result.nextState
    }
    return current.economic
  })

  const startEconomic = state.economic

  const forecast: BudgetForecast = {
    growth: widen(range(runs.map((e) => e.growth)), widthMultiplier),
    unemployment: widen(range(runs.map((e) => e.unemployment)), widthMultiplier),
    inflation: widen(range(runs.map((e) => e.inflation)), widthMultiplier),
    deficitRatio: widen(range(runs.map((e) => e.deficitRatio)), widthMultiplier),
    debtRatio: widen(range(runs.map((e) => e.debtRatio)), widthMultiplier),
    interestCost: widen(range(runs.map((e) => e.interestCost)), widthMultiplier),
    purchasingPowerDelta: widen(range(runs.map((e) => e.purchasingPower - startEconomic.purchasingPower)), widthMultiplier),
    confidence: confidenceFromWidthMultiplier(widthMultiplier),
  }

  return forecast
}
