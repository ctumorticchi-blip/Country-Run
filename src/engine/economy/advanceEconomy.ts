import { scheduleDelayedEffect, type DelayedEffect } from '../effects/delayedEffect.ts'
import type { SeededRng } from '../seeded-rng/SeededRng.ts'
import type { EconomicState, GameState } from '../state/gameState.ts'
import { advanceTurn } from '../state/turnEngine.ts'
import { annualPercentToPerTurnFraction } from './annualization.ts'
import type { EconomicEngineConfig } from './config/types.ts'
import { computeBusinessConfidence, computeConsumerConfidence, computeMarketConfidence } from './confidence.ts'
import { computeDebt, computeEffectiveDebtRate, computeInterestCost } from './debt.ts'
import { computeFiscalBalance, computePublicRevenue, computePublicSpending } from './fiscal.ts'
import { computeGrowth, computePotentialGrowth } from './growth.ts'
import { computeInflation } from './inflation.ts'
import { applyEconomicInvariants } from './invariants.ts'
import { computePurchasingPower } from './purchasingPower.ts'
import { driftProductivityGrowth, scheduleStructuralDelayedEffects } from './productivity.ts'
import { computeUnemployment } from './unemployment.ts'
import type { EconomicDiagnostics, EconomicPolicyInput, ExternalShock, WorldState } from './types.ts'
import { applyExternalShocksToWorld } from './worldState.ts'

export interface AdvanceEconomyResult {
  nextEconomicState: EconomicState
  diagnostics: EconomicDiagnostics
  /** New DelayedEffects this turn's structural policies scheduled — the caller merges these into `state.delayedEffects`. */
  scheduledDelayedEffects: DelayedEffect[]
}

/**
 * The pure economic step: given a GameState (already advanced to the turn
 * being computed — see `advanceEconomicTurn` for the full turn pipeline),
 * computes the next EconomicState. Never touches `meta`, `political`,
 * `social`, `policy`, or `delayedEffects` directly — see
 * docs/ECONOMIC_ENGINE.md ("Ordre d'exécution d'un tour") for the exact
 * order these sub-computations run in and why.
 */
export function advanceEconomy(
  state: GameState,
  policyInput: EconomicPolicyInput,
  worldState: WorldState,
  rng: SeededRng,
  config: EconomicEngineConfig,
  shocks: readonly ExternalShock[] = [],
): AdvanceEconomyResult {
  const economic = state.economic
  const currentTurn = state.meta.turn

  // 1. Resolve shocks against the world and pull out their immediate effects.
  const world = applyExternalShocksToWorld(worldState, shocks)
  const crisisEffect = shocks.reduce((sum, shock) => sum + (shock.directGrowthEffect ?? 0), 0)
  const shockConsumerDelta = shocks.reduce((sum, shock) => sum + (shock.confidence?.consumerConfidence ?? 0), 0)
  const shockBusinessDelta = shocks.reduce((sum, shock) => sum + (shock.confidence?.businessConfidence ?? 0), 0)
  const shockMarketDelta = shocks.reduce((sum, shock) => sum + (shock.confidence?.marketConfidence ?? 0), 0)

  // 2. Potential growth (labor + productivity), recomputed fresh every turn.
  const potentialGrowth = computePotentialGrowth(economic.productivityGrowth, config.potentialGrowth)

  // 3. Growth.
  const { growth, contributions: growthContributions } = computeGrowth({
    potentialGrowth,
    gdp: economic.gdp,
    policyInput,
    world,
    consumerConfidencePrev: economic.consumerConfidence,
    businessConfidencePrev: economic.businessConfidence,
    productivityGrowth: economic.productivityGrowth,
    publicSectorEfficiencyPrev: economic.publicSectorEfficiency,
    crisisEffect,
    rng,
    config: config.growth,
  })

  // 4. Unemployment (structuralUnemployment itself only moves via matured delayed effects, resolved before this runs).
  const unemploymentNext = computeUnemployment({
    unemploymentPrev: economic.unemployment,
    structuralUnemploymentPrev: economic.structuralUnemployment,
    growth,
    potentialGrowth,
    config: config.unemployment,
  })
  const structuralUnemploymentNext = economic.structuralUnemployment

  // 5. Inflation.
  const { inflation: inflationNext, contributions: inflationContributions } = computeInflation({
    inflationPrev: economic.inflation,
    growth,
    potentialGrowth,
    gdp: economic.gdp,
    world,
    taxImpulse: policyInput.householdTaxImpulse + policyInput.businessTaxImpulse,
    rng,
    config: config.inflation,
  })

  // 6. GDP levels — explicit per-turn fraction, never the full annual rate.
  const nominalGrowth = growth + inflationNext
  const gdpNext = economic.gdp * (1 + annualPercentToPerTurnFraction(growth))
  const nominalGdpNext = economic.nominalGdp * (1 + annualPercentToPerTurnFraction(nominalGrowth))

  // 7. Debt rate / interest cost — progressive refinancing, uses PREVIOUS marketConfidence to avoid circularity.
  const effectiveDebtRateNext = computeEffectiveDebtRate({
    effectiveDebtRatePrev: economic.effectiveDebtRate,
    world,
    marketConfidencePrev: economic.marketConfidence,
    config: config.debt,
  })
  const interestCostNext = computeInterestCost(effectiveDebtRateNext, economic.debt)

  // 8. Revenue.
  const { publicRevenue: publicRevenueNext, revenueSurprise } = computePublicRevenue({
    publicRevenuePrev: economic.publicRevenue,
    nominalGrowth,
    taxChanges: policyInput.taxChanges,
    rng,
    config: config.revenue,
  })

  // 9. Spending.
  const publicSpendingNext = computePublicSpending({
    publicSpendingPrev: economic.publicSpending,
    interestCostPrev: economic.interestCost,
    interestCostNext,
    currentSpendingChanges: policyInput.currentSpendingChanges,
    publicInvestmentChanges: policyInput.publicInvestmentChanges,
    transfersChanges: policyInput.transfersChanges,
    config: config.spending,
  })

  // 10. Fiscal balance / deficit.
  const { fiscalBalance, deficit, deficitRatio: deficitRatioNext } = computeFiscalBalance(
    publicRevenueNext,
    publicSpendingNext,
    nominalGdpNext,
  )

  // 11. Debt stock — only the per-turn slice of the annualized fiscal balance accumulates.
  const { debt: debtNext, debtRatio: debtRatioNext } = computeDebt({
    debtPrev: economic.debt,
    nominalGdpNext,
    fiscalBalance,
    config: config.debt,
  })

  // 12. Purchasing power (cumulative index).
  const purchasingPowerNext = computePurchasingPower({
    purchasingPowerPrev: economic.purchasingPower,
    nominalIncomeGrowth: nominalGrowth,
    inflation: inflationNext,
    gdp: economic.gdp,
    transfersChanges: policyInput.transfersChanges,
    householdTaxImpulse: policyInput.householdTaxImpulse,
    config: config.purchasingPower,
  })
  // Used only as the consumer-confidence purchasing-power signal (transfers/tax already folded into computePurchasingPower above).
  const realIncomeGrowthAnnualized = nominalGrowth - inflationNext

  // 13-15. Confidence — market first (used by business's financing-cost read next turn via effectiveDebtRate),
  // then consumer, then business, all reading each other's PREVIOUS value to avoid same-turn circularity.
  const marketConfidenceNext = computeMarketConfidence({
    marketConfidencePrev: economic.marketConfidence,
    debtRatioNext,
    deficitRatioNext,
    deficitRatioPrev: economic.deficitRatio,
    growthNext: growth,
    potentialGrowthNext: potentialGrowth,
    shockDelta: shockMarketDelta,
    config: config.confidence.market,
  })

  const consumerConfidenceNext = computeConsumerConfidence({
    consumerConfidencePrev: economic.consumerConfidence,
    unemploymentNext,
    structuralUnemploymentNext,
    realIncomeGrowthAnnualized,
    inflationNext,
    marketConfidencePrev: economic.marketConfidence,
    shockDelta: shockConsumerDelta,
    config: config.confidence.consumer,
  })

  const businessConfidenceNext = computeBusinessConfidence({
    businessConfidencePrev: economic.businessConfidence,
    growthNext: growth,
    potentialGrowthNext: potentialGrowth,
    businessTaxImpulse: policyInput.businessTaxImpulse,
    gdp: economic.gdp,
    effectiveDebtRateNext,
    ecbRate: world.ecbRate,
    marketConfidencePrev: economic.marketConfidence,
    consumerConfidencePrev: economic.consumerConfidence,
    shockDelta: shockBusinessDelta,
    config: config.confidence.business,
  })

  // 16. Productivity drift + structural delayed effects scheduled by this turn's investments/reforms.
  const productivityGrowthNext = driftProductivityGrowth(economic.productivityGrowth, config.productivity)
  const scheduledDelayedEffects = scheduleStructuralDelayedEffects(
    currentTurn,
    policyInput,
    rng,
    config.productivity,
    config.unemployment,
  )

  const rawNextEconomicState: EconomicState = {
    gdp: gdpNext,
    nominalGdp: nominalGdpNext,
    potentialGrowth,
    growth,
    inflation: inflationNext,
    unemployment: unemploymentNext,
    structuralUnemployment: structuralUnemploymentNext,
    publicRevenue: publicRevenueNext,
    publicSpending: publicSpendingNext,
    fiscalBalance,
    deficit,
    deficitRatio: deficitRatioNext,
    debt: debtNext,
    debtRatio: debtRatioNext,
    effectiveDebtRate: effectiveDebtRateNext,
    interestCost: interestCostNext,
    purchasingPower: purchasingPowerNext,
    productivityGrowth: productivityGrowthNext,
    consumerConfidence: consumerConfidenceNext,
    businessConfidence: businessConfidenceNext,
    marketConfidence: marketConfidenceNext,
    publicSectorEfficiency: economic.publicSectorEfficiency, // only moves via matured delayed effects
  }

  const nextEconomicState = applyEconomicInvariants(rawNextEconomicState, config)

  const diagnostics: EconomicDiagnostics = {
    growthContributions,
    inflationContributions,
    confidenceContributions: {
      consumer: nextEconomicState.consumerConfidence - economic.consumerConfidence,
      business: nextEconomicState.businessConfidence - economic.businessConfidence,
      market: nextEconomicState.marketConfidence - economic.marketConfidence,
    },
    revenueSurprise,
    interestRateChange: nextEconomicState.effectiveDebtRate - economic.effectiveDebtRate,
    unemploymentChange: nextEconomicState.unemployment - economic.unemployment,
  }

  return { nextEconomicState, diagnostics, scheduledDelayedEffects }
}

export interface AdvanceEconomicTurnResult {
  nextState: GameState
  diagnostics: EconomicDiagnostics
}

/**
 * The full turn pipeline: advances the calendar and resolves due delayed
 * effects (M0's generic `advanceTurn`), runs the economic step on top of
 * that, then merges the result — the updated economic state and any newly
 * scheduled structural delayed effects — back into a full GameState. This
 * is the function scenario simulations and (eventually) the game loop call.
 */
export function advanceEconomicTurn(
  state: GameState,
  policyInput: EconomicPolicyInput,
  worldState: WorldState,
  rng: SeededRng,
  config: EconomicEngineConfig,
  shocks: readonly ExternalShock[] = [],
): AdvanceEconomicTurnResult {
  const turnAdvanced = advanceTurn(state)
  const { nextEconomicState, diagnostics, scheduledDelayedEffects } = advanceEconomy(
    turnAdvanced,
    policyInput,
    worldState,
    rng,
    config,
    shocks,
  )

  const stateWithNewEconomy: GameState = { ...turnAdvanced, economic: nextEconomicState }
  const nextState = scheduledDelayedEffects.reduce(
    (acc, delayedEffect) => scheduleDelayedEffect(acc, delayedEffect),
    stateWithNewEconomy,
  )

  return { nextState, diagnostics }
}
