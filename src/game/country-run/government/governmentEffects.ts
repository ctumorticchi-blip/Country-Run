import type { EconomicEngineConfig } from '../../../engine/economy/config/types.ts'
import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'
import type { GovernmentModifiers } from './governmentTypes.ts'

/**
 * ⚠️ CONTROLLED INTEGRATION POINTS ONLY (M3 §16). Government modifiers must
 * never mutate `DEFAULT_ECONOMIC_ENGINE_CONFIG` or any other generic engine
 * object in place — every function here is PURE and returns a new value.
 * This is the complete list of the 7 places a government modifier is
 * allowed to reach into gameplay:
 *
 * 1. `economicExecution`  -> applyExecutionScaling (scales fiscal/investment policy fields)
 * 2. `reformEffectiveness` -> applyExecutionScaling (scales the 2 reform intensity fields)
 * 3. `parliamentNegotiation` -> scaleParliamentPassProbability
 * 4. `popularityResilience` -> applyPopularityResilience
 * 5. `marketCredibility` -> governmentMarketConfidenceNudge
 * 6. `fiscalForecastAccuracy` -> fiscalEstimateRangeWidth (UI-only range width, never touches the engine)
 * 7. `implementationSpeed` -> deriveGovernmentEngineConfig (per-playthrough config clone)
 */

const REFORM_FIELDS = ['laborMarketReform', 'publicSectorReform'] as const

/** Integration points 1-2: scales enacted policy by execution quality, reforms by reform effectiveness, before it reaches the engine. */
export function applyExecutionScaling(policy: EconomicPolicyInput, modifiers: GovernmentModifiers): EconomicPolicyInput {
  const scaled = { ...policy }
  for (const key of Object.keys(scaled) as (keyof EconomicPolicyInput)[]) {
    const isReformField = (REFORM_FIELDS as readonly string[]).includes(key)
    scaled[key] = policy[key] * (isReformField ? modifiers.reformEffectiveness : modifiers.economicExecution)
  }
  return scaled
}

/** Integration point 3: bounded so Parliament outcomes never become fully certain either way. */
export function scaleParliamentPassProbability(baseProbability: number, modifiers: GovernmentModifiers): number {
  return Math.min(0.98, Math.max(0.05, baseProbability * modifiers.parliamentNegotiation))
}

/** Integration point 4: a resilient government loses less popularity from the same bad news; gains are never amplified. */
export function applyPopularityResilience(delta: number, modifiers: GovernmentModifiers): number {
  return delta < 0 ? delta / modifiers.popularityResilience : delta
}

/** Integration point 5: a one-time marketConfidence nudge (±5pt at the modifier extremes), applied once at government selection. */
export function governmentMarketConfidenceNudge(modifiers: GovernmentModifiers): number {
  return (modifiers.marketCredibility - 1) * 50
}

/** Integration point 6: UI-only — widens/narrows a displayed estimate range, e.g. "+/- X Md€". Never affects simulation. */
export function fiscalEstimateRangeWidth(baseWidth: number, modifiers: GovernmentModifiers): number {
  return baseWidth * (2 - modifiers.fiscalForecastAccuracy)
}

/**
 * Integration point 7: returns a NEW config object (never mutates `config`)
 * with delayed-effect horizons scaled by implementation speed — a faster
 * government sees infrastructure/research/reform payoffs sooner. This is
 * the "per-playthrough config clone" pattern: callers pass this derived
 * config into `advanceEconomicTurn` instead of the shared default, so the
 * shared default object is never touched.
 */
export function deriveGovernmentEngineConfig(config: EconomicEngineConfig, modifiers: GovernmentModifiers): EconomicEngineConfig {
  const scaleDelay = (turns: number): number => Math.max(1, Math.round(turns / modifiers.implementationSpeed))

  return {
    ...config,
    unemployment: { ...config.unemployment, structuralReformDelayTurns: scaleDelay(config.unemployment.structuralReformDelayTurns) },
    productivity: {
      ...config.productivity,
      infrastructureDelayTurns: scaleDelay(config.productivity.infrastructureDelayTurns),
      researchDelayTurns: scaleDelay(config.productivity.researchDelayTurns),
      educationDelayTurns: scaleDelay(config.productivity.educationDelayTurns),
      publicSectorReformDelayTurns: scaleDelay(config.productivity.publicSectorReformDelayTurns),
    },
  }
}
