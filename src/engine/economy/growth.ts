import type { SeededRng } from '../seeded-rng/SeededRng.ts'
import type { EconomicEngineConfig } from './config/types.ts'
import { controlledNoise } from './noise.ts'
import type { EconomicDiagnostics, EconomicPolicyInput, WorldState } from './types.ts'

/**
 * Potential growth = labor + productivity (Product Bible §6). Recomputed
 * fresh every turn from the current `productivityGrowth` — it is never
 * itself the target of a delayed effect (that would create a
 * write-then-overwrite bug the next turn); structural policies instead
 * target `productivityGrowth`, which this formula already passes through
 * (see productivity.ts).
 */
export function computePotentialGrowth(productivityGrowth: number, config: EconomicEngineConfig['potentialGrowth']): number {
  return config.laborContribution + productivityGrowth * config.productivityPassthrough
}

export interface ComputeGrowthInput {
  potentialGrowth: number
  gdp: number
  /** Used for the tax-impulse terms only — a sustained tax stance is treated as a persistent demand effect. */
  policyInput: EconomicPolicyInput
  /**
   * The CHANGE in policy stance since last turn (`computePolicyDelta`), used
   * for the spending-side terms (`currentSpendingChanges`,
   * `publicInvestmentChanges`, `transfersChanges`) only. Product Bible §6
   * ("Temporalité des effets") frames a spending/investment demand impulse
   * as a 12-24 month adjustment, not a permanent per-turn boost for as long
   * as the policy stays active — using the raw sustained level here instead
   * would let a spending increase keep re-boosting growth every turn
   * forever, letting it effectively "pay for itself" in the debt ratio
   * regardless of how large it is (see docs/ECONOMIC_ENGINE.md, "Policy
   * input units").
   */
  policyDelta: EconomicPolicyInput
  world: WorldState
  /** Previous turn's confidence readings — this turn's confidence is computed after growth, so using it would be circular. */
  consumerConfidencePrev: number
  businessConfidencePrev: number
  productivityGrowth: number
  publicSectorEfficiencyPrev: number
  /** Sum of active shocks' directGrowthEffect, annualized pp. 0 when no shock. */
  crisisEffect: number
  rng: SeededRng
  config: EconomicEngineConfig['growth']
}

/**
 * growth = potentialGrowth + fiscalImpulse + externalEffect + confidenceEffect
 *          + productivityEffect + crisisEffect + controlledNoise
 * (Product Bible §6). All terms are annualized percentage points — turning
 * this into a GDP level change is the caller's job, via
 * `annualPercentToPerTurnFraction` (see advanceEconomy.ts).
 */
export function computeGrowth(input: ComputeGrowthInput): { growth: number; contributions: EconomicDiagnostics['growthContributions'] } {
  const { potentialGrowth, gdp, policyInput, policyDelta, world, consumerConfidencePrev, businessConfidencePrev, productivityGrowth, config } =
    input

  // Public investment's demand effect scales with how efficiently the public sector executes it
  // (Product Bible §6, "Services publics = dépenses/investissements × efficacité × qualité d'exécution").
  const effectivePublicInvestmentDelta = policyDelta.publicInvestmentChanges * (input.publicSectorEfficiencyPrev / 100)

  const fiscalImpulse =
    (policyDelta.currentSpendingChanges * config.fiscalMultiplier.currentSpending +
      effectivePublicInvestmentDelta * config.fiscalMultiplier.publicInvestment +
      policyDelta.transfersChanges * config.fiscalMultiplier.transfers -
      policyInput.businessTaxImpulse * config.fiscalMultiplier.businessTax -
      policyInput.householdTaxImpulse * config.fiscalMultiplier.householdTax) /
    gdp *
    100

  const externalEffect = world.eurozoneGrowth * config.externalEurozoneWeight + world.globalTradeGrowth * config.externalTradeWeight

  const confidenceEffect = (((consumerConfidencePrev + businessConfidencePrev) / 2 - 50) / 50) * 10 * config.confidenceWeight

  const productivityEffect = productivityGrowth * config.productivityPassthrough

  const noise = controlledNoise(input.rng, config.noiseStdDev)

  const contributions: EconomicDiagnostics['growthContributions'] = {
    potentialGrowth,
    fiscalImpulse,
    externalEffect,
    confidenceEffect,
    productivityEffect,
    crisisEffect: input.crisisEffect,
    noise,
  }

  const growth =
    potentialGrowth + fiscalImpulse + externalEffect + confidenceEffect + productivityEffect + input.crisisEffect + noise

  return { growth, contributions }
}
