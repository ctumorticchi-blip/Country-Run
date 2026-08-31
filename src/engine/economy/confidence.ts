import type { EconomicEngineConfig } from './config/types.ts'

function clamp01to100(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export interface ComputeConsumerConfidenceInput {
  consumerConfidencePrev: number
  unemploymentNext: number
  structuralUnemploymentNext: number
  realIncomeGrowthAnnualized: number
  inflationNext: number
  marketConfidencePrev: number
  shockDelta: number
  config: EconomicEngineConfig['confidence']['consumer']
}

/**
 * Each confidence index (Product Bible §6, §12) mean-reverts toward a
 * "target" implied by this turn's fundamentals, rather than jumping to it —
 * this is what keeps confidence from swinging explosively turn to turn
 * (M1 brief, "Évite les boucles explosives"). `shockDelta` is an immediate,
 * additive hit from an ExternalShock, applied on top of the mean-reversion
 * step. All three functions read *previous*-turn confidence for the
 * cross-index "stability" term, since consumer/business/market confidence
 * are computed in the same turn and must not depend on each other's
 * not-yet-computed next value.
 */
export function computeConsumerConfidence(input: ComputeConsumerConfidenceInput): number {
  const { consumerConfidencePrev, unemploymentNext, structuralUnemploymentNext, realIncomeGrowthAnnualized, inflationNext, marketConfidencePrev, shockDelta, config } = input

  const employmentSignal = structuralUnemploymentNext - unemploymentNext
  const purchasingPowerSignal = Math.min(5, Math.max(-5, realIncomeGrowthAnnualized))
  const inflationDiscomfort = Math.max(0, inflationNext - 2)
  const stabilitySignal = ((marketConfidencePrev - 50) / 50) * 10

  const target =
    50 +
    config.employmentWeight * employmentSignal +
    config.purchasingPowerWeight * purchasingPowerSignal -
    config.inflationWeight * inflationDiscomfort +
    config.stabilityWeight * stabilitySignal

  const next = consumerConfidencePrev + config.meanReversion * (target - consumerConfidencePrev) + shockDelta
  return clamp01to100(next)
}

export interface ComputeBusinessConfidenceInput {
  businessConfidencePrev: number
  growthNext: number
  potentialGrowthNext: number
  businessTaxImpulse: number
  gdp: number
  effectiveDebtRateNext: number
  ecbRate: number
  marketConfidencePrev: number
  consumerConfidencePrev: number
  shockDelta: number
  config: EconomicEngineConfig['confidence']['business']
}

export function computeBusinessConfidence(input: ComputeBusinessConfidenceInput): number {
  const {
    businessConfidencePrev,
    growthNext,
    potentialGrowthNext,
    businessTaxImpulse,
    gdp,
    effectiveDebtRateNext,
    ecbRate,
    marketConfidencePrev,
    consumerConfidencePrev,
    shockDelta,
    config,
  } = input

  const growthSignal = growthNext - potentialGrowthNext
  const taxSignal = (businessTaxImpulse / gdp) * 100
  const financingCostSignal = effectiveDebtRateNext - ecbRate
  const stabilitySignal = ((marketConfidencePrev - 50) / 50) * 10
  const demandSignal = ((consumerConfidencePrev - 50) / 50) * 10

  const target =
    50 +
    config.growthWeight * growthSignal -
    config.taxWeight * taxSignal -
    config.financingCostWeight * financingCostSignal +
    config.stabilityWeight * stabilitySignal +
    config.demandWeight * demandSignal

  const next = businessConfidencePrev + config.meanReversion * (target - businessConfidencePrev) + shockDelta
  return clamp01to100(next)
}

export interface ComputeMarketConfidenceInput {
  marketConfidencePrev: number
  debtRatioNext: number
  deficitRatioNext: number
  deficitRatioPrev: number
  growthNext: number
  potentialGrowthNext: number
  shockDelta: number
  config: EconomicEngineConfig['confidence']['market']
}

export function computeMarketConfidence(input: ComputeMarketConfidenceInput): number {
  const { marketConfidencePrev, debtRatioNext, deficitRatioNext, deficitRatioPrev, growthNext, potentialGrowthNext, shockDelta, config } =
    input

  const debtSignal = Math.max(0, debtRatioNext - 90)
  const deficitSignal = Math.max(0, deficitRatioNext - 3)
  const growthSignal = growthNext - potentialGrowthNext
  const trajectorySignal = deficitRatioPrev - deficitRatioNext // positive = deficit improving

  const target =
    50 -
    config.debtRatioWeight * debtSignal -
    config.deficitRatioWeight * deficitSignal +
    config.growthWeight * growthSignal +
    config.trajectoryWeight * trajectorySignal

  const next = marketConfidencePrev + config.meanReversion * (target - marketConfidencePrev) + shockDelta
  return clamp01to100(next)
}
