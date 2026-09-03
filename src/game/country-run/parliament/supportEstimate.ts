import type { GovernmentModifiers } from '../government/governmentTypes.ts'
import type { ParliamentComposition } from '../prototype/parliamentComposition.ts'
import { getBlocDefinition } from './blocDefinitions.ts'
import type { ParliamentBlocDefinition } from './blocTypes.ts'
import { getRelation, type BlocRelations } from './blocRelations.ts'
import type { EffectiveBill } from './concessions.ts'
import type { BlocStance, ConcessionType, PolicyAffinity, PolicyDimension, SupportConfidence } from './politicalTypes.ts'

/**
 * ⚠️ THE centralized bill-support formula (M4 §6-7). Every negotiation and
 * vote screen reads support through this module — no magic numbers live in
 * UI components. Every number below is a documented, gameplay-tuned
 * coefficient, not a sourced political-science estimate (same "PROTOTYPE
 * PARAMETERS" caveat as `popularity.ts`/`scoring.ts`).
 *
 * This module only ever produces RANGES + a point estimate — the actual
 * vote (`voteResolution.ts`) is a separate, deterministic step (M4 §6:
 * "Do NOT show exact deterministic future votes before the vote").
 */

/** Seat-count uncertainty band applied around each bloc's point-estimate probability. */
const UNCERTAINTY_BAND = 0.15

function dimensionAffinityScore(billTags: PolicyAffinity, blocAffinity: PolicyAffinity): number {
  const dims = Object.keys(billTags) as PolicyDimension[]
  if (dims.length === 0) return 0
  let weightedSum = 0
  let weightTotal = 0
  for (const dim of dims) {
    const billValue = billTags[dim] ?? 0
    weightedSum += billValue * (blocAffinity[dim] ?? 0)
    weightTotal += Math.abs(billValue)
  }
  return weightTotal === 0 ? 0 : weightedSum / weightTotal
}

function hitsRedLine(billTags: PolicyAffinity, blocDef: ParliamentBlocDefinition): boolean {
  return blocDef.redLines.some((dim) => (billTags[dim] ?? 0) <= -0.5)
}

interface SupportProbabilityInputs {
  bill: EffectiveBill
  blocDef: ParliamentBlocDefinition
  relationScore: number
  popularity: number
  governmentModifiers: GovernmentModifiers
  courted: boolean
  capitalSpentThisNegotiation: number
  promiseLinked: boolean
  /** The presidential coalition's own seat count out of `ABSOLUTE_MAJORITY` (M6.5 §11-12) — see `governmentStrengthBonus` below. */
  presidentialSeats: number
  /** Deals this bloc was promised and that did NOT come through (M6.5 §14-15) — see `repeatedBetrayalPenalty` below. */
  brokenDealCount: number
}

/** M4 §21's constant, duplicated here (not imported) to avoid a `parliament.ts` <-> `supportEstimate.ts` import cycle risk — both already independently define/consume Parliament-wide constants. */
const ABSOLUTE_MAJORITY_SEATS = 289

/**
 * The single point-estimate probability [0, 1] that a given bloc's seats
 * vote FOR the bill, folding in every M4 §7 input:
 * bloc/bill affinity, promise alignment, government negotiation modifier,
 * political capital spent, popularity (capped, per §26 — never enough
 * alone to manufacture a majority), previous relationship, courting, and
 * bill controversy/red lines — plus two M6.5 §11-15 structural additions,
 * `governmentStrengthBonus` and `repeatedBetrayalPenalty` (see below).
 */
export function computeBlocSupportProbability(inputs: SupportProbabilityInputs): number {
  const { bill, blocDef, relationScore, popularity, governmentModifiers, courted, capitalSpentThisNegotiation, promiseLinked, presidentialSeats, brokenDealCount } = inputs
  const affinity = dimensionAffinityScore(bill.policyTags, blocDef.policyAffinity)

  const base = 0.5 + affinity * 0.42 + blocDef.baseGovernmentSupport * 0.22
  const relationBonus = (relationScore / 100) * 0.15
  const popularityBonus = ((popularity - 50) / 50) * 0.05
  const negotiationModifierBonus = (governmentModifiers.parliamentNegotiation - 1) * 0.5
  // Les Experts (M4 §25): fiscalForecastAccuracy buys extra credibility specifically with discipline-sensitive blocs.
  const fiscalCredibilityBonus = blocDef.politicalTags.includes('fiscalDiscipline') ? (governmentModifiers.fiscalForecastAccuracy - 1) * 0.3 : 0
  // Les Réformateurs (M4 §25): higher reformEffectiveness reads as more social resistance on already-controversial bills.
  const controversyGovBoost = bill.definition.controversy * (governmentModifiers.reformEffectiveness - 1) * 0.5
  const controversyPenalty = (bill.definition.controversy + controversyGovBoost) * 0.28 * (1 - Math.max(0, affinity))
  const courtedBonus = courted ? 0.08 : 0
  const capitalBonus = Math.min(0.2, capitalSpentThisNegotiation / 100)
  const promiseBonus = promiseLinked ? 0.03 : 0
  /**
   * M6.5 §11-12: THE structural fix for "budgets pass almost automatically
   * under a weak majority" — a small presidential coalition genuinely
   * commands less automatic deference from opposition blocs, independent
   * of any one bill's own content. In [-0.14, +0.06]: a strong majority
   * (≥289 seats on its own) gets a small default-cooperation bonus; a
   * fragmented Assembly (well under 240) starts every negotiation at a
   * real structural deficit that only courting/concessions/capital
   * (unaffected by this term) can close — never a hard wall, always
   * recoverable through the existing negotiation levers.
   */
  const governmentStrengthBonus = Math.min(0.06, Math.max(-0.14, ((presidentialSeats - ABSOLUTE_MAJORITY_SEATS) / ABSOLUTE_MAJORITY_SEATS) * 0.32))
  /** M6.5 §14-15: a bloc betrayed on past deals (promised a concession/courting, still voted against, or the bill it was promised on failed) discounts the government's credibility further each time, up to a cap — "harder to negotiate with", never impossible. */
  const repeatedBetrayalPenalty = Math.min(0.15, brokenDealCount * 0.04)

  let probability =
    base +
    relationBonus +
    popularityBonus +
    negotiationModifierBonus +
    fiscalCredibilityBonus -
    controversyPenalty +
    courtedBonus +
    capitalBonus +
    promiseBonus +
    governmentStrengthBonus -
    repeatedBetrayalPenalty

  if (hitsRedLine(bill.policyTags, blocDef)) {
    probability = Math.min(probability, courted || capitalSpentThisNegotiation > 0 ? 0.35 : 0.15)
  }

  return Math.min(0.97, Math.max(0.03, probability))
}

export function classifyStance(probability: number): BlocStance {
  if (probability >= 0.75) return 'FORTEMENT_FAVORABLE'
  if (probability >= 0.55) return 'PLUTÔT_FAVORABLE'
  if (probability >= 0.45) return 'PARTAGÉ'
  if (probability >= 0.25) return 'PLUTÔT_DÉFAVORABLE'
  return 'FORTEMENT_DÉFAVORABLE'
}

const DIMENSION_OBJECTION_COPY: Record<PolicyDimension, string> = {
  publicSpending: 'Le niveau de dépense publique doit rester maîtrisé.',
  fiscalDiscipline: 'Le déficit doit rester sous contrôle.',
  businessTax: 'Les entreprises ne doivent pas être davantage taxées.',
  householdTax: 'Les ménages ne doivent pas être davantage taxés.',
  environment: 'Ce texte ne fait pas assez pour l’environnement.',
  health: 'Les moyens pour la santé restent insuffisants.',
  education: 'Les moyens pour l’éducation restent insuffisants.',
  defense: 'L’effort de défense est jugé insuffisant.',
  pensions: 'Les retraites ne sont pas suffisamment protégées.',
  housing: 'L’effort pour le logement reste insuffisant.',
  laborMarket: 'Cette réforme du marché du travail pose problème.',
  publicInvestment: 'L’investissement public reste insuffisant.',
}

function describeMainObjection(bill: EffectiveBill, blocDef: ParliamentBlocDefinition): string | null {
  const dims = Object.keys(bill.policyTags) as PolicyDimension[]
  let worstDim: PolicyDimension | null = null
  let worstScore = 0
  for (const dim of dims) {
    const score = (bill.policyTags[dim] ?? 0) * (blocDef.policyAffinity[dim] ?? 0)
    if (score < worstScore) {
      worstScore = score
      worstDim = dim
    }
  }
  if (!worstDim || worstScore >= -0.05) return null
  return DIMENSION_OBJECTION_COPY[worstDim]
}

export interface BlocSupportEstimate {
  blocId: string
  blocName: string
  seats: number
  stance: BlocStance
  supportProbability: number
  supportRangeLow: number
  supportRangeHigh: number
  mainObjection: string | null
  possibleConcession: ConcessionType | null
}

export interface BillSupportEstimate {
  presidentialSeats: number
  blocBreakdown: BlocSupportEstimate[]
  likelyAlliesLow: number
  likelyAlliesHigh: number
  likelyTotalLow: number
  likelyTotalHigh: number
  majorityNeeded: number
  confidence: SupportConfidence
}

function classifyConfidence(low: number, high: number, threshold: number): SupportConfidence {
  if (low >= threshold || high < threshold) return 'HIGH'
  const mid = (low + high) / 2
  const width = high - low
  if (width === 0) return 'HIGH'
  return Math.abs(mid - threshold) > width * 0.25 ? 'MEDIUM' : 'LOW'
}

export interface ActiveNegotiationSnapshot {
  courtedBlocIds: readonly string[]
  capitalSpent: number
}

/**
 * The full pre-vote estimate shown on the negotiation screen (M4 §11) —
 * always ranges, never a single deterministic number. Never itself stored:
 * `GamePrototypeState` only stores what `activeBill`/`blocRelations`
 * actually need (M4 §36); this is recomputed on every render.
 */
export function estimateBillSupport(
  bill: EffectiveBill,
  composition: ParliamentComposition,
  blocRelations: BlocRelations,
  popularity: number,
  governmentModifiers: GovernmentModifiers,
  negotiation: ActiveNegotiationSnapshot | null,
  /** M6.5 §14-15 — defaults to none for callers that don't yet track deal history. */
  politicalDeals: readonly { blocId: string; fulfilled: boolean }[] = [],
): BillSupportEstimate {
  const presidentialBloc = composition.blocs.find((b) => b.isPlayerCoalition)
  const presidentialSeats = presidentialBloc?.seats ?? 0
  const promiseLinked = bill.definition.promiseLinks.length > 0

  const blocBreakdown: BlocSupportEstimate[] = composition.blocs
    .filter((b) => !b.isPlayerCoalition)
    .map((b): BlocSupportEstimate => {
      const blocDef = getBlocDefinition(b.id)
      const probability = computeBlocSupportProbability({
        bill,
        blocDef,
        relationScore: getRelation(blocRelations, b.id),
        popularity,
        governmentModifiers,
        courted: negotiation?.courtedBlocIds.includes(b.id) ?? false,
        capitalSpentThisNegotiation: negotiation?.capitalSpent ?? 0,
        promiseLinked,
        presidentialSeats,
        brokenDealCount: politicalDeals.filter((d) => d.blocId === b.id && !d.fulfilled).length,
      })
      return {
        blocId: b.id,
        blocName: blocDef.name,
        seats: b.seats,
        stance: classifyStance(probability),
        supportProbability: probability,
        supportRangeLow: Math.round(Math.max(0, probability - UNCERTAINTY_BAND) * b.seats),
        supportRangeHigh: Math.round(Math.min(1, probability + UNCERTAINTY_BAND) * b.seats),
        mainObjection: describeMainObjection(bill, blocDef),
        possibleConcession: blocDef.preferredConcessions.find((c) => bill.definition.concessionsAvailable.includes(c)) ?? null,
      }
    })

  const likelyAlliesLow = blocBreakdown.reduce((sum, b) => sum + b.supportRangeLow, 0)
  const likelyAlliesHigh = blocBreakdown.reduce((sum, b) => sum + b.supportRangeHigh, 0)
  const likelyTotalLow = presidentialSeats + likelyAlliesLow
  const likelyTotalHigh = presidentialSeats + likelyAlliesHigh
  const majorityNeeded = bill.definition.voteThreshold

  return {
    presidentialSeats,
    blocBreakdown,
    likelyAlliesLow,
    likelyAlliesHigh,
    likelyTotalLow,
    likelyTotalHigh,
    majorityNeeded,
    confidence: classifyConfidence(likelyTotalLow, likelyTotalHigh, majorityNeeded),
  }
}
