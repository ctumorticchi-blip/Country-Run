import { MAX_ELECTION_SCORE_PCT, MIN_ELECTION_SCORE_PCT } from './electionResult.ts'
import type { MajorityOutcome } from './parliamentComposition.ts'

/**
 * ⚠️ ARCHITECTURE-ONLY (M3 §21). `politicalCapital` is computed once at
 * mandate start from the campaign/legislative outcome and stored on
 * `GamePrototypeState` for display — nothing in M3 spends or replenishes
 * it during gameplay yet. A later milestone is expected to make decisions
 * cost/reward it; wiring that up is explicitly out of scope here.
 */
export const MIN_POLITICAL_CAPITAL = 0
export const MAX_POLITICAL_CAPITAL = 100

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
