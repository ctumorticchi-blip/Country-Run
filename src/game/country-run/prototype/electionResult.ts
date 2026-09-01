import { coherenceScore, dominantTags, isFiscallyDifficult } from '../promises/promiseSelection.ts'
import type { PoliticalTag } from '../promises/promiseTypes.ts'
import { createActionRng } from './rng.ts'

/**
 * ⚠️ PROTOTYPE-ONLY ELECTION MODEL (M3 §3-4). "Losing before gameplay is
 * useless" — the player ALWAYS wins, deterministically bounded to a
 * realistically tight runoff margin, never a landslide. The score still
 * reacts to the player's actual promise selection (coherence pulls it up,
 * an unfundable programme pulls it down), so the choice isn't cosmetic —
 * it just never crosses into a loss.
 */
export const MIN_ELECTION_SCORE_PCT = 50.5
export const MAX_ELECTION_SCORE_PCT = 54.0

/** Descriptive-only labels (M3 §2) — never an ideology judgment. */
export type PoliticalProfileLabel = 'RÉFORMATEUR' | 'INVESTISSEUR' | 'PROTECTEUR' | 'GESTIONNAIRE' | 'PRAGMATIQUE'

const TAG_TO_LABEL: Record<PoliticalTag, PoliticalProfileLabel> = {
  fiscalDiscipline: 'GESTIONNAIRE',
  taxCut: 'GESTIONNAIRE',
  socialProtection: 'PROTECTEUR',
  security: 'PROTECTEUR',
  investment: 'INVESTISSEUR',
  environment: 'INVESTISSEUR',
  reform: 'RÉFORMATEUR',
}

/** Below this coherence, the 5 promises pull in too many directions for any single descriptive label to fit. */
const COHERENCE_LABEL_THRESHOLD = 0.4

export function derivePoliticalProfileLabel(selectedPromiseIds: readonly string[]): PoliticalProfileLabel {
  const topTags = dominantTags(selectedPromiseIds, 1)
  if (topTags.length === 0 || coherenceScore(selectedPromiseIds) < COHERENCE_LABEL_THRESHOLD) return 'PRAGMATIQUE'
  return TAG_TO_LABEL[topTags[0]]
}

export interface ElectionResult {
  /** Always in [MIN_ELECTION_SCORE_PCT, MAX_ELECTION_SCORE_PCT] — a deterministic win. */
  scorePct: number
  profileLabel: PoliticalProfileLabel
  dominantTags: PoliticalTag[]
}

/**
 * Deterministic for a given seed + promise selection (same inputs => same
 * result, per M3 §29's replay requirement). Never calls `Math.random()`.
 */
export function computeElectionResult(seed: string, selectedPromiseIds: readonly string[]): ElectionResult {
  const coherence = coherenceScore(selectedPromiseIds)
  const difficultyPenalty = isFiscallyDifficult(selectedPromiseIds) ? 0.6 : 0
  const jitter = createActionRng(seed, 'election-result').float(-0.4, 0.4)

  const rawScore = MIN_ELECTION_SCORE_PCT + 1.75 + coherence * 1.2 - difficultyPenalty + jitter
  const scorePct = Math.round(Math.min(MAX_ELECTION_SCORE_PCT, Math.max(MIN_ELECTION_SCORE_PCT, rawScore)) * 10) / 10

  return { scorePct, profileLabel: derivePoliticalProfileLabel(selectedPromiseIds), dominantTags: dominantTags(selectedPromiseIds) }
}
