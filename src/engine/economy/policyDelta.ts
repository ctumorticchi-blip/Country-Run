import type { EconomicPolicyInput } from './types.ts'

/**
 * Computes the turn-over-turn CHANGE in policy stance.
 *
 * `EconomicPolicyInput` fields represent a SUSTAINED annualized level or
 * intensity (see types.ts, "Policy input units") — passing the same value
 * on consecutive turns means "this policy is still in effect", not "apply
 * this action again". Anything that accumulates into a stock or schedules
 * a one-off structural effect (the fiscal run-rate levels in `fiscal.ts`,
 * and the delayed effects scheduled in `productivity.ts`) must key off
 * this delta rather than the raw policyInput — otherwise a sustained
 * policy gets re-applied every single turn, compounding without bound.
 * `advanceEconomy` computes this once per turn from the current and
 * previous turn's policyInput and threads it to those two call sites; the
 * demand-side growth impulse, inflation pass-through, and confidence
 * signals intentionally keep using the raw (level) policyInput instead —
 * see docs/ECONOMIC_ENGINE.md ("Policy input units") for why that split is
 * correct rather than an oversight.
 */
export function computePolicyDelta(current: EconomicPolicyInput, previous: EconomicPolicyInput): EconomicPolicyInput {
  return {
    taxChanges: current.taxChanges - previous.taxChanges,
    currentSpendingChanges: current.currentSpendingChanges - previous.currentSpendingChanges,
    publicInvestmentChanges: current.publicInvestmentChanges - previous.publicInvestmentChanges,
    transfersChanges: current.transfersChanges - previous.transfersChanges,
    businessTaxImpulse: current.businessTaxImpulse - previous.businessTaxImpulse,
    householdTaxImpulse: current.householdTaxImpulse - previous.householdTaxImpulse,
    researchInvestment: current.researchInvestment - previous.researchInvestment,
    infrastructureInvestment: current.infrastructureInvestment - previous.infrastructureInvestment,
    educationInvestment: current.educationInvestment - previous.educationInvestment,
    laborMarketReform: current.laborMarketReform - previous.laborMarketReform,
    publicSectorReform: current.publicSectorReform - previous.publicSectorReform,
  }
}
