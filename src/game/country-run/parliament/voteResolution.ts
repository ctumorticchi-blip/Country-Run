import type { GovernmentModifiers } from '../government/governmentTypes.ts'
import type { ParliamentComposition } from '../prototype/parliamentComposition.ts'
import { createActionRng } from '../prototype/rng.ts'
import { getBlocDefinition } from './blocDefinitions.ts'
import { getRelation, type BlocRelations } from './blocRelations.ts'
import type { EffectiveBill } from './concessions.ts'
import { computeBlocSupportProbability, type ActiveNegotiationSnapshot } from './supportEstimate.ts'

/**
 * ⚠️ PROTOTYPE-ONLY VOTE RESOLUTION (M4 §17). Deterministic: the same
 * seed + bill + negotiation state (concessions, courted blocs, capital
 * spent, attempt number) always resolves to the same outcome — never calls
 * `Math.random()`. Always totals exactly the Assembly's seat count.
 */

const BASE_ABSTENTION_RATE = 0.12

/** [forShare, againstShare, abstainShare], summing to exactly 1 before rounding. */
function computeVoteShares(supportProbability: number, jitter: number): [number, number, number] {
  const convictionStrength = Math.abs(2 * supportProbability - 1)
  const abstainShare = BASE_ABSTENTION_RATE * (1 - convictionStrength)
  const adjustedProbability = Math.min(1, Math.max(0, supportProbability + jitter))
  const forShare = adjustedProbability * (1 - abstainShare)
  const againstShare = 1 - abstainShare - forShare
  return [forShare, againstShare, abstainShare]
}

/** Largest-remainder rounding — the 3 shares' seat counts always sum to exactly `seats`. */
function splitSeatsThreeWay(seats: number, shares: readonly [number, number, number]): [number, number, number] {
  const raw = shares.map((s) => s * seats)
  const floors = raw.map((v) => Math.floor(v))
  let missing = seats - floors.reduce((sum, v) => sum + v, 0)

  const order = raw.map((v, i) => [v - floors[i], i] as const).sort((a, b) => b[0] - a[0])
  const result = [...floors]
  let cursor = 0
  while (missing > 0) {
    result[order[cursor % order.length][1]] += 1
    missing -= 1
    cursor += 1
  }
  return result as [number, number, number]
}

export interface BlocVoteResult {
  blocId: string
  blocName: string
  seats: number
  votesFor: number
  votesAgainst: number
  abstentions: number
}

export interface VoteResult {
  votesFor: number
  votesAgainst: number
  abstentions: number
  blocBreakdown: BlocVoteResult[]
  passed: boolean
}

/**
 * Resolves the actual vote. `attemptNumber` is part of the deterministic
 * key (M4 §19 allows a renegotiate-and-revote loop, each attempt is its
 * own deterministic draw, capped by `MAX_VOTE_ATTEMPTS`).
 */
export function resolveVote(
  seed: string,
  attemptNumber: number,
  bill: EffectiveBill,
  composition: ParliamentComposition,
  blocRelations: BlocRelations,
  popularity: number,
  governmentModifiers: GovernmentModifiers,
  negotiation: ActiveNegotiationSnapshot | null,
): VoteResult {
  const rng = createActionRng(seed, `vote:${bill.definition.id}:attempt-${String(attemptNumber)}`)
  const promiseLinked = bill.definition.promiseLinks.length > 0

  const blocBreakdown: BlocVoteResult[] = composition.blocs.map((b) => {
    if (b.isPlayerCoalition) {
      return { blocId: b.id, blocName: b.name, seats: b.seats, votesFor: b.seats, votesAgainst: 0, abstentions: 0 }
    }

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
    })
    const jitter = rng.float(-0.05, 0.05)
    const [votesFor, votesAgainst, abstentions] = splitSeatsThreeWay(b.seats, computeVoteShares(probability, jitter))
    return { blocId: b.id, blocName: blocDef.name, seats: b.seats, votesFor, votesAgainst, abstentions }
  })

  const votesFor = blocBreakdown.reduce((sum, b) => sum + b.votesFor, 0)
  const votesAgainst = blocBreakdown.reduce((sum, b) => sum + b.votesAgainst, 0)
  const abstentions = blocBreakdown.reduce((sum, b) => sum + b.abstentions, 0)

  return { votesFor, votesAgainst, abstentions, blocBreakdown, passed: votesFor >= bill.definition.voteThreshold }
}
