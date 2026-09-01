import type { EconomicState } from '../../../engine/state/gameState.ts'
import type { PromiseResolution } from '../promises/promiseResolution.ts'

/**
 * ⚠️ PROTOTYPE-ONLY FINAL SCORING V2 (M5 §61-64), superseding M2's
 * `prototype/scoring.ts` (deleted — see git history for the 5-category
 * version this replaces). Still a simple, bounded, documented heuristic
 * over the real engine's start/end `EconomicState` plus this mandate's own
 * tracked outcomes — never presented as a validated metric. New weights
 * per the brief: Economy 25%, Public Finances 20%, Purchasing Power 15%,
 * Employment 10%, Promises 15%, Political Stability 10%, Public
 * Investment/Services 5%.
 */

function clamp0to100(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function scoreEconomy(end: EconomicState, start: EconomicState): number {
  const levelScore = clamp0to100(50 + (end.growth - 1.0) * 15)
  const trendScore = clamp0to100(50 + (end.growth - start.growth) * 20)
  return (levelScore + trendScore) / 2
}

function scorePublicFinances(end: EconomicState, start: EconomicState): number {
  const debtScore = clamp0to100(50 - (end.debtRatio - start.debtRatio) * 3)
  const deficitScore = clamp0to100(50 - (end.deficitRatio - 3) * 8)
  return (debtScore + deficitScore) / 2
}

/** `purchasingPower` is a cumulative index, 0 = baseline at mandate start. */
function scorePurchasingPower(end: EconomicState): number {
  return clamp0to100(50 + end.purchasingPower * 12)
}

function scoreEmployment(end: EconomicState, start: EconomicState): number {
  const levelScore = clamp0to100(50 - (end.unemployment - 7) * 6)
  const trendScore = clamp0to100(50 - (end.unemployment - start.unemployment) * 15)
  return (levelScore + trendScore) / 2
}

const PROMISE_WEIGHT: Record<PromiseResolution['finalStatus'], number> = { KEPT: 1, PARTIAL: 0.5, BROKEN: 0 }

/**
 * Every selected promise is guaranteed a frozen `PromiseResolution` by
 * mandate end (M5 §15-16's deadline resolution always fires before turn
 * 30) — there is no "avoid the deadline" dodge available to inflate this
 * score.
 */
function scorePromises(resolutions: readonly PromiseResolution[]): number {
  if (resolutions.length === 0) return 0
  const sum = resolutions.reduce((total, r) => total + PROMISE_WEIGHT[r.finalStatus], 0)
  return clamp0to100((sum / resolutions.length) * 100)
}

function scorePoliticalStability(finalPopularity: number, finalGovernmentTension: number, finalPoliticalCapital: number): number {
  const popularityScore = clamp0to100(finalPopularity)
  const tensionScore = clamp0to100(100 - finalGovernmentTension)
  const capitalScore = clamp0to100(finalPoliticalCapital)
  return popularityScore * 0.5 + tensionScore * 0.3 + capitalScore * 0.2
}

function scorePublicInvestmentServices(end: EconomicState, start: EconomicState): number {
  const productivityScore = clamp0to100(50 + (end.productivityGrowth - start.productivityGrowth) * 200)
  const efficiencyScore = clamp0to100(end.publicSectorEfficiency)
  return (productivityScore + efficiencyScore) / 2
}

export interface FinalScoreBreakdown {
  economy: number
  publicFinances: number
  purchasingPower: number
  employment: number
  promises: number
  politicalStability: number
  publicInvestmentServices: number
  /** [0, 1] — applied on top of the weighted sum so no single strong metric can fully mask a genuine 5-year catastrophe. */
  catastropheMultiplier: number
  /** Final score out of 10 000, matching the M2/M3 convention. */
  total: number
}

export interface FinalScoreInputs {
  start: EconomicState
  end: EconomicState
  finalPopularity: number
  finalGovernmentTension: number
  finalPoliticalCapital: number
  promiseResolutions: readonly PromiseResolution[]
}

export function computeFinalScore(inputs: FinalScoreInputs): FinalScoreBreakdown {
  const { start, end, finalPopularity, finalGovernmentTension, finalPoliticalCapital, promiseResolutions } = inputs

  const economy = scoreEconomy(end, start)
  const publicFinances = scorePublicFinances(end, start)
  const purchasingPower = scorePurchasingPower(end)
  const employment = scoreEmployment(end, start)
  const promises = scorePromises(promiseResolutions)
  const politicalStability = scorePoliticalStability(finalPopularity, finalGovernmentTension, finalPoliticalCapital)
  const publicInvestmentServices = scorePublicInvestmentServices(end, start)

  const weighted =
    economy * 0.25 +
    publicFinances * 0.2 +
    purchasingPower * 0.15 +
    employment * 0.1 +
    promises * 0.15 +
    politicalStability * 0.1 +
    publicInvestmentServices * 0.05

  // Catastrophic-threshold penalties, recalibrated for 5-year mandate deltas
  // (not a simple multiple of M2's 1-year thresholds — a mandate is expected
  // to see larger cumulative swings than a single year without that being
  // catastrophic on its own).
  let catastropheMultiplier = 1
  const debtRatioDelta = end.debtRatio - start.debtRatio
  if (debtRatioDelta > 15 && end.deficitRatio > 6) catastropheMultiplier *= 0.85
  if (end.growth < -1) catastropheMultiplier *= 0.85
  if (end.unemployment - start.unemployment > 3) catastropheMultiplier *= 0.9
  if (finalGovernmentTension > 85) catastropheMultiplier *= 0.9

  const total = Math.round(weighted * catastropheMultiplier * 100)

  return {
    economy,
    publicFinances,
    purchasingPower,
    employment,
    promises,
    politicalStability,
    publicInvestmentServices,
    catastropheMultiplier,
    total: Math.min(10000, Math.max(0, total)),
  }
}

/**
 * Descriptive of the SHAPE of the mandate, never an ideological judgment
 * (M2 §20, carried forward). Rule-based, checked in priority order — the
 * first matching rule wins, so more specific/extreme shapes are listed
 * before the general fallback.
 */
export type EndingTitle =
  | 'LA TEMPÊTE DU QUINQUENNAT'
  | 'LE BÂTISSEUR'
  | 'LE RÉFORMATEUR'
  | 'LE PARI RISQUÉ'
  | 'LE PRÉSIDENT DES PROMESSES TENUES'
  | 'LE TECHNOCRATE'
  | 'LE POPULAIRE FRAGILE'
  | 'LE GESTIONNAIRE PRUDENT'
  | 'LE GESTIONNAIRE'

export interface EndingTitleInputs {
  start: EconomicState
  end: EconomicState
  finalPopularity: number
  finalGovernmentTension: number
  promiseResolutions: readonly PromiseResolution[]
  /** Count of discretionary reform bills adopted across the mandate (the yearly Conseil des Ministres bill, M5 §35-37) — excludes the 5 mandatory Budget bills. */
  reformsEnacted: number
}

export function computeEndingTitle(inputs: EndingTitleInputs): EndingTitle {
  const { start, end, finalPopularity, finalGovernmentTension, promiseResolutions, reformsEnacted } = inputs

  const growthDelta = end.growth - start.growth
  const debtRatioDelta = end.debtRatio - start.debtRatio
  const deficitRatioDelta = end.deficitRatio - start.deficitRatio
  const unemploymentDelta = end.unemployment - start.unemployment
  const efficiencyDelta = end.publicSectorEfficiency - start.publicSectorEfficiency

  const keptCount = promiseResolutions.filter((r) => r.finalStatus === 'KEPT').length
  const totalPromises = promiseResolutions.length || 1
  const keptFraction = keptCount / totalPromises

  const badGrowth = growthDelta < -0.3 || end.growth < -0.5
  const badDebt = debtRatioDelta > 15
  const badPopularity = finalPopularity < 35
  const badTension = finalGovernmentTension > 80
  const badCount = [badGrowth, badDebt, badPopularity, badTension, unemploymentDelta > 2].filter(Boolean).length

  if (badCount >= 3) return 'LA TEMPÊTE DU QUINQUENNAT'
  if (efficiencyDelta > 8 && debtRatioDelta <= 10) return 'LE BÂTISSEUR'
  if (reformsEnacted >= 3 && keptFraction >= 0.5) return 'LE RÉFORMATEUR'
  if (growthDelta > 0.3 && debtRatioDelta > 10) return 'LE PARI RISQUÉ'
  if (keptFraction >= 0.8) return 'LE PRÉSIDENT DES PROMESSES TENUES'
  if (finalPopularity < 45 && growthDelta >= 0 && deficitRatioDelta <= 0.5) return 'LE TECHNOCRATE'
  if (finalPopularity >= 60 && (debtRatioDelta > 8 || deficitRatioDelta > 1)) return 'LE POPULAIRE FRAGILE'
  if (deficitRatioDelta < -0.3 && growthDelta < 0.3) return 'LE GESTIONNAIRE PRUDENT'
  return 'LE GESTIONNAIRE'
}
