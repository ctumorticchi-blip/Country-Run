import type { SeededRng } from '../../../engine/seeded-rng/SeededRng.ts'
import type { GovernmentModifiers } from '../government/governmentTypes.ts'
import { OPPOSITION_BLOC_DEFINITIONS } from '../parliament/blocDefinitions.ts'
import { coherenceScore, dominantTags } from '../promises/promiseSelection.ts'
import type { PoliticalTag } from '../promises/promiseTypes.ts'
import { MAX_ELECTION_SCORE_PCT, MIN_ELECTION_SCORE_PCT } from './electionResult.ts'
import { ABSOLUTE_MAJORITY, TOTAL_SEATS } from './parliament.ts'
import { createActionRng } from './rng.ts'

/**
 * ⚠️ PROTOTYPE-ONLY LEGISLATIVE ELECTION (M3 §6-7, bloc list upgraded to
 * the canonical M4 set in `parliament/blocDefinitions.ts` — §2: "Preserve
 * the M3 Parliament composition architecture"). Entirely fictional blocs —
 * no real French party is named or implied. Distinct from
 * `parliament.ts`'s single pass/fail coin flip (the old M2-lite Budget
 * vote mechanic, replaced in M4 by `parliament/voteResolution.ts`): this
 * generates the Assembly's actual seat composition once, right after the
 * campaign.
 */
export const PLAYER_SEATS_MIN = 220
export const PLAYER_SEATS_MAX = 300

export type MajorityOutcome = 'MAJORITÉ_ABSOLUE' | 'MAJORITÉ_RELATIVE' | 'ASSEMBLÉE_FRAGMENTÉE'

export interface ParliamentBloc {
  id: string
  name: string
  seats: number
  isPlayerCoalition: boolean
  affinityTags: PoliticalTag[]
}

export interface ParliamentComposition {
  blocs: ParliamentBloc[]
  playerSeats: number
  majorityOutcome: MajorityOutcome
}

function classifyMajority(playerSeats: number): MajorityOutcome {
  if (playerSeats >= ABSOLUTE_MAJORITY) return 'MAJORITÉ_ABSOLUE'
  if (playerSeats >= 240) return 'MAJORITÉ_RELATIVE'
  return 'ASSEMBLÉE_FRAGMENTÉE'
}

function computePlayerSeats(electionScorePct: number, coherence: number, parliamentNegotiation: number, rng: SeededRng): number {
  const scoreFraction = (electionScorePct - MIN_ELECTION_SCORE_PCT) / (MAX_ELECTION_SCORE_PCT - MIN_ELECTION_SCORE_PCT)
  const base = PLAYER_SEATS_MIN + scoreFraction * 50
  const coherenceBonus = coherence * 25
  const negotiationBonus = (parliamentNegotiation - 1) * 150
  const jitter = rng.integer(-10, 10)
  const raw = base + coherenceBonus + negotiationBonus + jitter
  return Math.round(Math.min(PLAYER_SEATS_MAX, Math.max(PLAYER_SEATS_MIN, raw)))
}

/** A bloc sharing a political tag with the player's programme sees some of its base weight drift to the player coalition instead. */
function blocWeight(bloc: (typeof OPPOSITION_BLOC_DEFINITIONS)[number], playerDominantTags: readonly PoliticalTag[], rng: SeededRng): number {
  const overlaps = bloc.politicalTags.some((tag) => playerDominantTags.includes(tag))
  const affinityFactor = overlaps ? 0.8 : 1.15
  return bloc.seatWeight * affinityFactor * rng.float(0.85, 1.15)
}

/** Distributes `remainder` seats across `weights`'s blocs proportionally, with any rounding remainder going to the largest weights first — deterministic given `weights`. */
function proportionalSplit(remainder: number, weights: readonly number[]): number[] {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  const floors = weights.map((w) => Math.floor((w / totalWeight) * remainder))
  let missing = remainder - floors.reduce((sum, v) => sum + v, 0)

  const order = weights.map((_, i) => i).sort((a, b) => weights[b] - weights[a])
  const result = [...floors]
  let cursor = 0
  while (missing > 0) {
    result[order[cursor % order.length]] += 1
    missing -= 1
    cursor += 1
  }
  return result
}

/**
 * Deterministic for a given seed + election result + promise selection +
 * government profile (M3 §29: same inputs => same Parliament; different
 * campaign choices => a different Parliament). Always totals exactly
 * `TOTAL_SEATS` (577). Never calls `Math.random()`.
 */
export function generateParliamentComposition(
  seed: string,
  electionScorePct: number,
  selectedPromiseIds: readonly string[],
  governmentModifiers: GovernmentModifiers,
): ParliamentComposition {
  const rng = createActionRng(seed, 'legislative-election')
  const coherence = coherenceScore(selectedPromiseIds)
  const playerDominantTags = dominantTags(selectedPromiseIds)

  const playerSeats = computePlayerSeats(electionScorePct, coherence, governmentModifiers.parliamentNegotiation, rng)
  const oppositionRemainder = TOTAL_SEATS - playerSeats

  const weights = OPPOSITION_BLOC_DEFINITIONS.map((bloc) => blocWeight(bloc, playerDominantTags, rng))
  const oppositionSeats = proportionalSplit(oppositionRemainder, weights)

  const blocs: ParliamentBloc[] = [
    { id: 'PRESIDENTIAL_BLOC', name: 'Majorité Présidentielle', seats: playerSeats, isPlayerCoalition: true, affinityTags: playerDominantTags },
    ...OPPOSITION_BLOC_DEFINITIONS.map((bloc, i) => ({
      id: bloc.id,
      name: bloc.name,
      seats: oppositionSeats[i],
      isPlayerCoalition: false,
      affinityTags: bloc.politicalTags,
    })),
  ]

  return { blocs, playerSeats, majorityOutcome: classifyMajority(playerSeats) }
}
