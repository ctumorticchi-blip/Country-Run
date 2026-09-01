import type { EconomicDiagnostics } from '../../../engine/economy/types.ts'
import type { Turn } from '../../../engine/state/gameState.ts'
import type { PolicyHistoryEntry } from '../prototype/policyHistory.ts'

/**
 * M5 §14: "CE QUI A CHANGÉ" — a causal, heuristic explanation of why an
 * indicator moved, built ONLY from real simulation inputs (the engine's own
 * `EconomicDiagnostics` breakdown, already computed every turn by
 * `advanceEconomy` — see `engine/economy/types.ts`'s doc comment — plus
 * this turn's `PolicyHistoryEntry` records). Never invented narrative, and
 * never exposes a raw internal coefficient — only a ranked list of
 * plain-language driver labels.
 */
export interface EconomicChangeExplanation {
  indicator: string
  previousValue: number
  newValue: number
  primaryDrivers: string[]
  secondaryDrivers: string[]
  /** HIGH: one driver clearly dominates. MEDIUM: a driver leads but others matter too. LOW: dominated by noise/many small factors, or nothing moved. */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

const GROWTH_DRIVER_LABEL: Record<keyof EconomicDiagnostics['growthContributions'], string> = {
  potentialGrowth: 'Croissance potentielle de l’économie',
  fiscalImpulse: 'Impact de la politique budgétaire',
  externalEffect: 'Conjoncture internationale',
  confidenceEffect: 'Confiance des ménages et des entreprises',
  productivityEffect: 'Gains de productivité',
  crisisEffect: 'Choc conjoncturel',
  noise: 'Aléas économiques',
}

const INFLATION_DRIVER_LABEL: Record<keyof EconomicDiagnostics['inflationContributions'], string> = {
  inertia: 'Inertie de l’inflation passée',
  demandPressure: 'Pression de la demande intérieure',
  external: 'Prix à l’international',
  energy: 'Prix de l’énergie',
  tax: 'Effet des taxes',
  noise: 'Aléas économiques',
}

const NOISE_KEYS = new Set(['noise'])
const HIGH_CONFIDENCE_SHARE = 0.5
const MEDIUM_CONFIDENCE_SHARE = 0.25
const SECONDARY_DRIVER_MIN_SHARE = 0.12

/**
 * Ranks a diagnostics contribution record by absolute magnitude and splits
 * it into primary/secondary driver labels plus a confidence read — shared
 * by every indicator's explanation so the ranking rule never drifts between
 * growth and inflation.
 */
function rankContributions<K extends string>(
  contributions: Record<K, number>,
  labels: Record<K, string>,
): { primaryDrivers: string[]; secondaryDrivers: string[]; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } {
  const entries = (Object.entries(contributions) as [K, number][])
    .map(([key, value]) => ({ key, value, abs: Math.abs(value) }))
    .sort((a, b) => b.abs - a.abs)

  const total = entries.reduce((sum, e) => sum + e.abs, 0)
  if (total === 0) return { primaryDrivers: [], secondaryDrivers: [], confidence: 'LOW' }

  const top = entries[0]
  const topShare = top.abs / total
  const topIsNoise = NOISE_KEYS.has(top.key)

  const primaryDrivers = topIsNoise ? [] : [labels[top.key]]
  const secondaryDrivers = entries
    .slice(1)
    .filter((e) => e.abs / total >= SECONDARY_DRIVER_MIN_SHARE && !NOISE_KEYS.has(e.key))
    .map((e) => labels[e.key])

  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
  if (!topIsNoise) {
    if (topShare >= HIGH_CONFIDENCE_SHARE) confidence = 'HIGH'
    else if (topShare >= MEDIUM_CONFIDENCE_SHARE) confidence = 'MEDIUM'
  }

  return { primaryDrivers, secondaryDrivers, confidence }
}

/** This turn's own policy decisions read as an honest, concrete driver whenever one exists — never inferred, only an echo of what was actually recorded. */
function policyDriversThisTurn(policyHistory: readonly PolicyHistoryEntry[], turn: Turn): string[] {
  return policyHistory.filter((entry) => entry.turn === turn).map((entry) => entry.label)
}

export function explainGrowthChange(
  previous: number,
  next: number,
  diagnostics: EconomicDiagnostics,
  policyHistory: readonly PolicyHistoryEntry[],
  turn: Turn,
): EconomicChangeExplanation {
  const ranked = rankContributions(diagnostics.growthContributions, GROWTH_DRIVER_LABEL)
  const policyDrivers = policyDriversThisTurn(policyHistory, turn)
  return {
    indicator: 'growth',
    previousValue: previous,
    newValue: next,
    primaryDrivers: [...policyDrivers, ...ranked.primaryDrivers],
    secondaryDrivers: ranked.secondaryDrivers,
    confidence: policyDrivers.length > 0 && ranked.confidence === 'LOW' ? 'MEDIUM' : ranked.confidence,
  }
}

export function explainInflationChange(previous: number, next: number, diagnostics: EconomicDiagnostics): EconomicChangeExplanation {
  const ranked = rankContributions(diagnostics.inflationContributions, INFLATION_DRIVER_LABEL)
  return {
    indicator: 'inflation',
    previousValue: previous,
    newValue: next,
    primaryDrivers: ranked.primaryDrivers,
    secondaryDrivers: ranked.secondaryDrivers,
    confidence: ranked.confidence,
  }
}

/** Unemployment has no direct diagnostics breakdown — explained via any labor-market policy recorded this turn, plus a link to growth's own leading driver when growth actually moved. */
export function explainUnemploymentChange(
  previous: number,
  next: number,
  diagnostics: EconomicDiagnostics,
  policyHistory: readonly PolicyHistoryEntry[],
  turn: Turn,
): EconomicChangeExplanation {
  const policyDrivers = policyDriversThisTurn(policyHistory, turn)
  const growthRanked = rankContributions(diagnostics.growthContributions, GROWTH_DRIVER_LABEL)
  const activityDriver = 'Dynamique de l’activité économique'
  const inferredFromGrowth = diagnostics.unemploymentChange !== 0 && growthRanked.primaryDrivers.length > 0

  const primaryDrivers = policyDrivers.length > 0 ? policyDrivers : inferredFromGrowth ? [activityDriver] : []
  const secondaryDrivers = policyDrivers.length > 0 && inferredFromGrowth ? [activityDriver] : []

  return {
    indicator: 'unemployment',
    previousValue: previous,
    newValue: next,
    primaryDrivers,
    secondaryDrivers,
    confidence: policyDrivers.length > 0 ? 'MEDIUM' : inferredFromGrowth ? 'LOW' : 'LOW',
  }
}
