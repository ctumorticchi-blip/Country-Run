import { describe, expect, it } from 'vitest'
import type { GovernmentModifiers } from '../government/governmentTypes.ts'
import type { ParliamentComposition } from '../prototype/parliamentComposition.ts'
import { applyConcessionsToBill } from './concessions.ts'
import type { PoliticalBillDefinition } from './billTypes.ts'
import { resolveVote } from './voteResolution.ts'

const NEUTRAL: GovernmentModifiers = {
  economicExecution: 1,
  fiscalForecastAccuracy: 1,
  reformEffectiveness: 1,
  parliamentNegotiation: 1,
  popularityResilience: 1,
  marketCredibility: 1,
  implementationSpeed: 1,
}

const COMPOSITION: ParliamentComposition = {
  playerSeats: 260,
  majorityOutcome: 'MAJORITÉ_RELATIVE',
  blocs: [
    { id: 'PRESIDENTIAL_BLOC', name: 'Majorité', seats: 260, isPlayerCoalition: true, affinityTags: [] },
    { id: 'REFORM_CENTER', name: 'Centre', seats: 90, isPlayerCoalition: false, affinityTags: [] },
    { id: 'SOCIAL_LEFT', name: 'Sociaux', seats: 80, isPlayerCoalition: false, affinityTags: [] },
    { id: 'ECOLOGISTS', name: 'Écolos', seats: 40, isPlayerCoalition: false, affinityTags: [] },
    { id: 'CONSERVATIVE_RIGHT', name: 'Droite', seats: 60, isPlayerCoalition: false, affinityTags: [] },
    { id: 'NATIONAL_POPULISTS', name: 'Populistes', seats: 37, isPlayerCoalition: false, affinityTags: [] },
    { id: 'NON_ATTACHED', name: 'Non-Inscrits', seats: 10, isPlayerCoalition: false, affinityTags: [] },
  ],
}
const TOTAL_SEATS = COMPOSITION.blocs.reduce((sum, b) => sum + b.seats, 0)

const BILL: PoliticalBillDefinition = {
  id: 'test-bill',
  title: 'Test',
  description: '',
  policyTags: { health: 0.9, publicSpending: 0.4 },
  economicPolicyEffect: { currentSpendingChanges: 10 },
  fiscalCost: 10,
  reformIntensity: 0.3,
  controversy: 0.15,
  promiseLinks: [],
  requiredPoliticalCapital: 6,
  urgency: 'MEDIUM',
  negotiability: 0.7,
  concessionsAvailable: [],
  voteThreshold: 289,
  implementationDelay: 1,
}
const EFFECTIVE = applyConcessionsToBill(BILL, [])

describe('resolveVote — always totals exactly the Assembly seat count', () => {
  it('votesFor + votesAgainst + abstentions === total seats', () => {
    const result = resolveVote('seed-1', 1, EFFECTIVE, COMPOSITION, {}, 50, NEUTRAL, null)
    expect(result.votesFor + result.votesAgainst + result.abstentions).toBe(TOTAL_SEATS)
  })

  it('every bloc row also sums to its own seat count', () => {
    const result = resolveVote('seed-1', 1, EFFECTIVE, COMPOSITION, {}, 50, NEUTRAL, null)
    for (const bloc of result.blocBreakdown) {
      expect(bloc.votesFor + bloc.votesAgainst + bloc.abstentions).toBe(bloc.seats)
    }
  })

  it('the presidential bloc always votes for in full, with no defections', () => {
    const result = resolveVote('seed-1', 1, EFFECTIVE, COMPOSITION, {}, 50, NEUTRAL, null)
    const presidential = result.blocBreakdown.find((b) => b.blocId === 'PRESIDENTIAL_BLOC')
    expect(presidential?.votesFor).toBe(260)
    expect(presidential?.votesAgainst).toBe(0)
    expect(presidential?.abstentions).toBe(0)
  })
})

describe('resolveVote — determinism (M4 §17)', () => {
  it('the same seed, attempt, bill and negotiation state reproduce an identical result', () => {
    const a = resolveVote('determinism-check', 1, EFFECTIVE, COMPOSITION, {}, 50, NEUTRAL, null)
    const b = resolveVote('determinism-check', 1, EFFECTIVE, COMPOSITION, {}, 50, NEUTRAL, null)
    expect(a).toEqual(b)
  })

  it('never calls Math.random', () => {
    const originalRandom = Math.random
    let called = false
    Math.random = () => {
      called = true
      return originalRandom()
    }
    try {
      resolveVote('purity-check', 1, EFFECTIVE, COMPOSITION, {}, 50, NEUTRAL, null)
      expect(called).toBe(false)
    } finally {
      Math.random = originalRandom
    }
  })

  it('a different attempt number can produce a different result for the same seed', () => {
    const results = new Set(
      Array.from({ length: 5 }, (_, i) => JSON.stringify(resolveVote('attempt-check', i + 1, EFFECTIVE, COMPOSITION, {}, 50, NEUTRAL, null).votesFor)),
    )
    expect(results.size).toBeGreaterThan(1)
  })

  it('a different seed can produce a different result', () => {
    const a = resolveVote('seed-a', 1, EFFECTIVE, COMPOSITION, {}, 50, NEUTRAL, null)
    const b = resolveVote('seed-b', 1, EFFECTIVE, COMPOSITION, {}, 50, NEUTRAL, null)
    expect(a.votesFor).not.toBe(b.votesFor)
  })
})

describe('resolveVote — majority threshold', () => {
  it('passed is true exactly when votesFor >= voteThreshold', () => {
    const result = resolveVote('threshold-check', 1, EFFECTIVE, COMPOSITION, {}, 50, NEUTRAL, null)
    expect(result.passed).toBe(result.votesFor >= EFFECTIVE.definition.voteThreshold)
  })
})
