import type { DelayedEffect } from '../effects/delayedEffect.ts'
import type { SeededRng } from '../seeded-rng/SeededRng.ts'
import type { Turn } from '../state/gameState.ts'
import type { EconomicEngineConfig } from './config/types.ts'
import { controlledNoise } from './noise.ts'
import type { EconomicPolicyInput } from './types.ts'

/**
 * `productivityGrowth` only moves two ways: a tiny per-turn drift (this
 * function), and the delayed effects scheduled below when it matures. It
 * is never bumped directly by a same-turn policy input — that's what makes
 * "certaines politiques prises aujourd'hui peuvent influencer
 * progressivement les tours futurs" (Product Bible §15) actually true
 * rather than instantaneous.
 */
export function driftProductivityGrowth(productivityGrowthPrev: number, config: EconomicEngineConfig['productivity']): number {
  return productivityGrowthPrev + config.baseDriftPerTurn
}

/**
 * Turns this turn's structural policy inputs into DelayedEffects the
 * caller must merge into `state.delayedEffects` (via `scheduleDelayedEffect`
 * from `engine/effects`). Investment categories mature at different
 * horizons (Product Bible §15: infrastructure medium-term, R&D long-term
 * and uncertain, education very slow, public sector reform its own
 * horizon) — reusing the M0 delayed-effects system as-is, unmodified.
 *
 * Only non-zero inputs schedule an effect, to avoid cluttering the queue.
 */
export function scheduleStructuralDelayedEffects(
  currentTurn: Turn,
  policyInput: EconomicPolicyInput,
  rng: SeededRng,
  config: EconomicEngineConfig['productivity'],
  unemploymentConfig: EconomicEngineConfig['unemployment'],
): DelayedEffect[] {
  const effects: DelayedEffect[] = []

  if (policyInput.infrastructureInvestment !== 0) {
    effects.push({
      id: `infrastructure-t${String(currentTurn)}`,
      sourceId: 'infrastructureInvestment',
      executeAtTurn: currentTurn + config.infrastructureDelayTurns,
      effect: {
        type: 'add',
        path: 'economic.productivityGrowth',
        value: policyInput.infrastructureInvestment * config.infrastructureEffectPerBillion,
      },
    })
  }

  if (policyInput.researchInvestment !== 0) {
    const uncertainty = controlledNoise(rng, config.researchUncertainty)
    effects.push({
      id: `research-t${String(currentTurn)}`,
      sourceId: 'researchInvestment',
      executeAtTurn: currentTurn + config.researchDelayTurns,
      effect: {
        type: 'add',
        path: 'economic.productivityGrowth',
        value: policyInput.researchInvestment * config.researchEffectPerBillion * (1 + uncertainty),
      },
    })
  }

  if (policyInput.educationInvestment !== 0) {
    effects.push({
      id: `education-t${String(currentTurn)}`,
      sourceId: 'educationInvestment',
      executeAtTurn: currentTurn + config.educationDelayTurns,
      effect: {
        type: 'add',
        path: 'economic.productivityGrowth',
        value: policyInput.educationInvestment * config.educationEffectPerBillion,
      },
    })
  }

  if (policyInput.laborMarketReform !== 0) {
    effects.push({
      id: `labor-reform-t${String(currentTurn)}`,
      sourceId: 'laborMarketReform',
      executeAtTurn: currentTurn + unemploymentConfig.structuralReformDelayTurns,
      effect: {
        type: 'subtract',
        path: 'economic.structuralUnemployment',
        value: policyInput.laborMarketReform * unemploymentConfig.structuralReformEffectPerIntensity,
        min: unemploymentConfig.minUnemployment,
      },
    })
  }

  if (policyInput.publicSectorReform !== 0) {
    effects.push({
      id: `public-sector-reform-t${String(currentTurn)}`,
      sourceId: 'publicSectorReform',
      executeAtTurn: currentTurn + config.publicSectorReformDelayTurns,
      effect: {
        type: 'add',
        path: 'economic.publicSectorEfficiency',
        value: policyInput.publicSectorReform * config.publicSectorReformEfficiencyEffectPerIntensity,
        max: 100,
      },
    })
  }

  return effects
}
