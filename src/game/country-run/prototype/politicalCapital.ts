import type { EffectiveBill } from '../parliament/concessions.ts'
import { MAX_ELECTION_SCORE_PCT, MIN_ELECTION_SCORE_PCT } from './electionResult.ts'
import type { MajorityOutcome } from './parliamentComposition.ts'

/**
 * `politicalCapital` is computed once at mandate start from the
 * campaign/legislative outcome (M3 §21 — `computeInitialPoliticalCapital`,
 * unchanged). M4 §8-10 makes it functional: spent to propose/negotiate
 * bills, recovered slowly from successful votes and a good Year 1, lost
 * from rejections and forced procedures. Every function here is pure and
 * bounded to [MIN_POLITICAL_CAPITAL, MAX_POLITICAL_CAPITAL] — it can never
 * go negative.
 */
export const MIN_POLITICAL_CAPITAL = 0
export const MAX_POLITICAL_CAPITAL = 100

/** A single SPEND_POLITICAL_CAPITAL negotiation action, bounded to the "very controversial reform" tier (M4 §9). */
export const MAX_CAPITAL_SPEND_PER_ACTION = 20

const MAJORITY_BONUS: Record<MajorityOutcome, number> = {
  MAJORITÉ_ABSOLUE: 20,
  MAJORITÉ_RELATIVE: 8,
  ASSEMBLÉE_FRAGMENTÉE: -10,
}

export function clampPoliticalCapital(value: number): number {
  return Math.min(MAX_POLITICAL_CAPITAL, Math.max(MIN_POLITICAL_CAPITAL, value))
}

export function computeInitialPoliticalCapital(electionScorePct: number, majorityOutcome: MajorityOutcome, coherence: number): number {
  const scoreFraction = (electionScorePct - MIN_ELECTION_SCORE_PCT) / (MAX_ELECTION_SCORE_PCT - MIN_ELECTION_SCORE_PCT)
  const raw = 45 + scoreFraction * 15 + MAJORITY_BONUS[majorityOutcome] + coherence * 10
  return Math.round(clampPoliticalCapital(raw))
}

export function canAffordCapital(current: number, amount: number): boolean {
  return amount >= 0 && current >= amount
}

/** Always bounded to [0, MAX_POLITICAL_CAPITAL] — spending can never push it negative even if called without an affordability check first. */
export function spendCapital(current: number, amount: number): number {
  return clampPoliticalCapital(current - amount)
}

export function recoverCapital(current: number, amount: number): number {
  return clampPoliticalCapital(current + amount)
}

/** A signed outcome delta (recovery or penalty) in one call — bounded either direction. */
export function applyCapitalDelta(current: number, delta: number): number {
  return clampPoliticalCapital(current + delta)
}

export type ReformDifficulty = 'EASY' | 'MODERATE' | 'DIFFICULT' | 'VERY_CONTROVERSIAL'

const DIFFICULTY_CAPITAL_RANGE: Record<ReformDifficulty, [number, number]> = {
  EASY: [0, 5],
  MODERATE: [5, 12],
  DIFFICULT: [12, 20],
  VERY_CONTROVERSIAL: [20, 30],
}

/** M4 §9's 4 difficulty tiers, driven by a bill's `controversy` [0, 1]. */
export function classifyReformDifficulty(controversy: number): ReformDifficulty {
  if (controversy < 0.25) return 'EASY'
  if (controversy < 0.5) return 'MODERATE'
  if (controversy < 0.75) return 'DIFFICULT'
  return 'VERY_CONTROVERSIAL'
}

/** The displayed [low, high] Md-capital range for a bill's difficulty tier (M4 §32's "Political cost: 8-12 capital" example). */
export function politicalCapitalCostRange(controversy: number): [number, number] {
  return DIFFICULTY_CAPITAL_RANGE[classifyReformDifficulty(controversy)]
}

/**
 * M4 §10: capital recovers slowly on a successful vote (more for a
 * genuinely difficult reform actually delivered), and is lost on a
 * rejection (more for a more controversial bill) — deliberately modest
 * magnitudes so capital stays scarce across a whole mandate, not just
 * Year 1.
 */
export function politicalCapitalDeltaFromBillOutcome(bill: EffectiveBill, passed: boolean): number {
  if (passed) return Math.round(2 + bill.definition.reformIntensity * 3)
  return -Math.round(4 + bill.definition.controversy * 6)
}

/**
 * A small end-of-year drift from how the mandate actually went (M4 §10:
 * "strong election/popularity", "improving economy") — modest by design,
 * capped well below what a single bill vote moves.
 */
export function politicalCapitalDeltaFromYearEnd(initialPopularity: number, finalPopularity: number, growthDelta: number): number {
  const popularityEffect = Math.min(3, Math.max(-3, (finalPopularity - initialPopularity) * 0.3))
  const growthEffect = Math.min(2, Math.max(-2, growthDelta * 2))
  return Math.round(popularityEffect + growthEffect)
}
