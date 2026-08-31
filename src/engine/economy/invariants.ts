import type { EconomicState } from '../state/gameState.ts'
import type { EconomicEngineConfig } from './config/types.ts'

/**
 * Applies only the handful of bounds that are true invariants of the model
 * (a level, a rate, or an index that has crossed into physically or
 * structurally nonsensical territory), never a gameplay judgement call
 * about what counts as a "reasonable" trajectory. Deliberately narrow: a
 * huge deficit ratio or a crashed confidence index is meant to be visible
 * to the player and to tests, not silently clamped away (Product Bible
 * brief for M1, "Évite de masquer silencieusement un bug important").
 */
export function applyEconomicInvariants(economic: EconomicState, config: EconomicEngineConfig): EconomicState {
  return {
    ...economic,
    gdp: Math.max(config.bounds.minGdp, economic.gdp),
    nominalGdp: Math.max(config.bounds.minGdp, economic.nominalGdp),
    unemployment: clamp(economic.unemployment, config.unemployment.minUnemployment, config.unemployment.maxUnemployment),
    structuralUnemployment: clamp(
      economic.structuralUnemployment,
      config.unemployment.minUnemployment,
      config.unemployment.maxUnemployment,
    ),
    inflation: clamp(economic.inflation, config.inflation.minInflation, config.inflation.maxInflation),
    debt: Math.max(config.bounds.minDebt, economic.debt),
    effectiveDebtRate: Math.max(config.debt.minEffectiveDebtRate, economic.effectiveDebtRate),
    consumerConfidence: clamp(economic.consumerConfidence, 0, 100),
    businessConfidence: clamp(economic.businessConfidence, 0, 100),
    marketConfidence: clamp(economic.marketConfidence, 0, 100),
    publicSectorEfficiency: clamp(economic.publicSectorEfficiency, 0, 100),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Dev/test-only sanity check: throws if the state has drifted into a value
 * that indicates a genuine engine bug (NaN, Infinity, a negative level that
 * should never go negative) rather than just an extreme-but-legitimate
 * gameplay outcome. Not called from `advanceEconomy` itself — invariants
 * clamps handle the physically-necessary floors/ceilings; this is what
 * scenario/integration tests call to catch regressions.
 */
export function assertPlausibleEconomicState(economic: EconomicState): void {
  const numericEntries = Object.entries(economic) as [string, number][]
  for (const [key, value] of numericEntries) {
    if (!Number.isFinite(value)) {
      throw new Error(`EconomicState.${key} is not finite: ${String(value)}`)
    }
  }

  if (economic.gdp <= 0) throw new Error(`EconomicState.gdp must be > 0, got ${String(economic.gdp)}`)
  if (economic.nominalGdp <= 0) throw new Error(`EconomicState.nominalGdp must be > 0, got ${String(economic.nominalGdp)}`)
  if (economic.debt < 0) throw new Error(`EconomicState.debt must be >= 0, got ${String(economic.debt)}`)
  if (economic.deficit < 0) throw new Error(`EconomicState.deficit must be >= 0, got ${String(economic.deficit)}`)
  if (economic.unemployment < 0) throw new Error(`EconomicState.unemployment must be >= 0, got ${String(economic.unemployment)}`)

  for (const key of ['consumerConfidence', 'businessConfidence', 'marketConfidence', 'publicSectorEfficiency'] as const) {
    const value = economic[key]
    if (value < 0 || value > 100) throw new Error(`EconomicState.${key} must be within [0, 100], got ${String(value)}`)
  }
}
