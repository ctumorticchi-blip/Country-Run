import { describe, expect, it } from 'vitest'
import { getGovernmentProfile } from '../government/governmentProfiles.ts'
import { generateParliamentComposition, PLAYER_SEATS_MAX, PLAYER_SEATS_MIN } from './parliamentComposition.ts'
import { TOTAL_SEATS } from './parliament.ts'

const PROMISES_A = ['hospital-plan', 'invest-education', 'grand-investment-plan', 'energy-transition', 'build-housing']
const PROMISES_B = ['reduce-debt', 'reduce-deficit', 'no-tax-increase', 'reduce-unemployment', 'cut-business-taxes']
const EXPERTS = getGovernmentProfile('experts').modifiers
const POLITIQUES = getGovernmentProfile('politiques').modifiers

describe('parliamentComposition — always totals exactly 577 seats', () => {
  it('for many different seeds and promise selections', () => {
    for (const seed of ['seed-1', 'seed-2', 'seed-3', 'seed-4']) {
      for (const promises of [PROMISES_A, PROMISES_B]) {
        const composition = generateParliamentComposition(seed, 52, promises, EXPERTS)
        const total = composition.blocs.reduce((sum, bloc) => sum + bloc.seats, 0)
        expect(total).toBe(TOTAL_SEATS)
      }
    }
  })

  it('the player coalition seat count stays within [PLAYER_SEATS_MIN, PLAYER_SEATS_MAX]', () => {
    for (const scorePct of [50.5, 51, 52, 53, 54]) {
      const composition = generateParliamentComposition('bounds-check', scorePct, PROMISES_A, EXPERTS)
      expect(composition.playerSeats).toBeGreaterThanOrEqual(PLAYER_SEATS_MIN)
      expect(composition.playerSeats).toBeLessThanOrEqual(PLAYER_SEATS_MAX)
    }
  })

  it('every bloc has a non-negative seat count', () => {
    const composition = generateParliamentComposition('non-negative-check', 50.5, PROMISES_B, POLITIQUES)
    for (const bloc of composition.blocs) {
      expect(bloc.seats).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('parliamentComposition — determinism', () => {
  it('the same seed, score, promises and government modifiers reproduce an identical composition', () => {
    const a = generateParliamentComposition('determinism-check', 52.3, PROMISES_A, EXPERTS)
    const b = generateParliamentComposition('determinism-check', 52.3, PROMISES_A, EXPERTS)
    expect(a).toEqual(b)
  })

  it('a different promise selection can change the resulting composition for the same seed', () => {
    const a = generateParliamentComposition('promise-branch-check', 52, PROMISES_A, EXPERTS)
    const b = generateParliamentComposition('promise-branch-check', 52, PROMISES_B, EXPERTS)
    expect(a.playerSeats).not.toBe(b.playerSeats)
  })

  it('a different government profile can change the resulting composition for the same seed', () => {
    const a = generateParliamentComposition('gov-branch-check', 52, PROMISES_A, EXPERTS)
    const b = generateParliamentComposition('gov-branch-check', 52, PROMISES_A, POLITIQUES)
    expect(a.playerSeats).not.toBe(b.playerSeats)
  })
})

describe('parliamentComposition — majority classification', () => {
  it('classifies MAJORITÉ_ABSOLUE when playerSeats >= 289', () => {
    const composition = generateParliamentComposition('majority-check', 54, PROMISES_A, { ...EXPERTS, parliamentNegotiation: 1.1 })
    if (composition.playerSeats >= 289) expect(composition.majorityOutcome).toBe('MAJORITÉ_ABSOLUE')
  })
})
