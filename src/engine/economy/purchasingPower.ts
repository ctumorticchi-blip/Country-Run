import { annualRateToPerTurnRate } from './annualization.ts'
import type { EconomicEngineConfig } from './config/types.ts'

export interface ComputePurchasingPowerInput {
  purchasingPowerPrev: number
  /** growth + inflation for the turn (nominal income proxy), annualized %. */
  nominalIncomeGrowth: number
  inflation: number
  gdp: number
  transfersChanges: number
  householdTaxImpulse: number
  config: EconomicEngineConfig['purchasingPower']
}

/**
 * `purchasingPower` is a CUMULATIVE INDEX — percentage points of deviation
 * from the campaign-start baseline (0 at game start) — not a rate (see
 * gameState.ts for the convention). Each turn adds the per-turn share of
 * `realIncomeGrowth`:
 *
 *   realIncomeGrowth = nominalIncomeGrowth - inflation + transfersEffect - householdTaxEffect
 *
 * (Product Bible §6). Because both the index and the annualized rate are
 * already in "percent" units, this uses `annualRateToPerTurnRate` (a
 * straight division by turns/year), not the fraction-for-compounding
 * helper used for GDP/revenue/spending levels.
 */
export function computePurchasingPower(input: ComputePurchasingPowerInput): number {
  const { purchasingPowerPrev, nominalIncomeGrowth, inflation, gdp, transfersChanges, householdTaxImpulse, config } = input

  const transfersEffect = (transfersChanges / gdp) * 100 * config.transfersElasticity
  const householdTaxEffect = (householdTaxImpulse / gdp) * 100 * config.householdTaxElasticity

  const realIncomeGrowthAnnualized = nominalIncomeGrowth - inflation + transfersEffect - householdTaxEffect

  return purchasingPowerPrev + annualRateToPerTurnRate(realIncomeGrowthAnnualized)
}
