import { describe, expect, it } from 'vitest'
import { SeededRng } from '../seeded-rng/SeededRng.ts'
import type { GameState } from '../state/gameState.ts'
import { isEventEligible, rollEventTrigger } from './eligibility.ts'
import type { GameEvent } from './types.ts'

function makeState(overrides?: Partial<GameState>): GameState {
  return {
    meta: { seed: 'test', turn: 8, year: 2028, month: 1, phase: 'in_progress' },
    economic: {
      gdp: 2800,
      growth: 1.1,
      inflation: 2.2,
      unemployment: 9.4,
      deficitRatio: 5.1,
      debt: 3200,
      debtRatio: 112,
      purchasingPower: 0,
    },
    political: { popularity: 45, parliamentSeats: 289, politicalCredibility: 60 },
    social: { socialTension: 40 },
    policy: { activePolicies: [] },
    delayedEffects: [],
    ...overrides,
  }
}

describe('isEventEligible', () => {
  it('is eligible when it has no requires condition', () => {
    const event: GameEvent = { id: 'evt', title: 'No condition' }
    expect(isEventEligible(event, makeState())).toBe(true)
  })

  it('respects its requires condition', () => {
    const event: GameEvent = {
      id: 'evt',
      title: 'Late-mandate only',
      requires: { type: 'gte', path: 'meta.turn', value: 8 },
    }
    expect(isEventEligible(event, makeState())).toBe(true)
    expect(isEventEligible(event, makeState({ meta: { seed: 'test', turn: 3, year: 2027, month: 5, phase: 'in_progress' } }))).toBe(
      false,
    )
  })
})

describe('rollEventTrigger', () => {
  it('always triggers when probability is 1 or omitted', () => {
    const rng = new SeededRng('roll-check')
    const event: GameEvent = { id: 'evt', title: 'Certain' }
    for (let i = 0; i < 50; i++) {
      expect(rollEventTrigger(event, rng)).toBe(true)
    }
  })

  it('never triggers when probability is 0', () => {
    const rng = new SeededRng('roll-check-zero')
    const event: GameEvent = { id: 'evt', title: 'Impossible', probability: 0 }
    for (let i = 0; i < 50; i++) {
      expect(rollEventTrigger(event, rng)).toBe(false)
    }
  })

  it('is deterministic for a given seed and probability', () => {
    const event: GameEvent = { id: 'evt', title: 'Coin flip', probability: 0.5 }
    const rollSequence = (seed: string) => {
      const rng = new SeededRng(seed)
      return Array.from({ length: 30 }, () => rollEventTrigger(event, rng))
    }
    expect(rollSequence('replay-seed')).toEqual(rollSequence('replay-seed'))
  })
})
