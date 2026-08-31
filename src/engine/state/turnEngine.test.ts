import { describe, expect, it } from 'vitest'
import type { GameState } from './gameState.ts'
import { advanceTurn } from './turnEngine.ts'

function makeState(overrides?: Partial<GameState>): GameState {
  return {
    meta: { seed: 'test', turn: 0, year: 2027, month: 1, phase: 'in_progress' },
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

describe('advanceTurn', () => {
  it('increments the turn counter', () => {
    const state = makeState({ meta: { seed: 'test', turn: 3, year: 2027, month: 5, phase: 'in_progress' } })
    const next = advanceTurn(state)
    expect(next.meta.turn).toBe(4)
  })

  it('advances the calendar by 2 months per turn', () => {
    const state = makeState({ meta: { seed: 'test', turn: 0, year: 2027, month: 1, phase: 'in_progress' } })
    const next = advanceTurn(state)
    expect(next.meta.year).toBe(2027)
    expect(next.meta.month).toBe(3)
  })

  it('rolls over to the next year after 6 turns (12 months)', () => {
    const state = makeState({ meta: { seed: 'test', turn: 5, year: 2027, month: 11, phase: 'in_progress' } })
    const next = advanceTurn(state)
    expect(next.meta.year).toBe(2028)
    expect(next.meta.month).toBe(1)
  })

  it('applies delayed effects that just became due, and removes them from the queue', () => {
    const state = makeState({
      meta: { seed: 'test', turn: 3, year: 2027, month: 7, phase: 'in_progress' },
      delayedEffects: [
        { id: 'due-next-turn', effect: { type: 'add', path: 'political.popularity', value: 5 }, executeAtTurn: 4 },
      ],
    })

    const next = advanceTurn(state)

    expect(next.political.popularity).toBe(50)
    expect(next.delayedEffects).toEqual([])
  })

  it('leaves delayed effects further in the future untouched', () => {
    const state = makeState({
      meta: { seed: 'test', turn: 3, year: 2027, month: 7, phase: 'in_progress' },
      delayedEffects: [
        { id: 'far-future', effect: { type: 'add', path: 'political.popularity', value: 5 }, executeAtTurn: 10 },
      ],
    })

    const next = advanceTurn(state)

    expect(next.political.popularity).toBe(45)
    expect(next.delayedEffects).toHaveLength(1)
  })

  it('never mutates the original state', () => {
    const state = makeState({
      meta: { seed: 'test', turn: 3, year: 2027, month: 7, phase: 'in_progress' },
      delayedEffects: [
        { id: 'due-next-turn', effect: { type: 'add', path: 'political.popularity', value: 5 }, executeAtTurn: 4 },
      ],
    })
    const snapshot = JSON.parse(JSON.stringify(state)) as GameState

    advanceTurn(state)

    expect(state).toEqual(snapshot)
  })

  it('running 6 turns in a row advances the calendar by exactly one year', () => {
    let state = makeState({ meta: { seed: 'test', turn: 0, year: 2027, month: 1, phase: 'in_progress' } })
    for (let i = 0; i < 6; i++) {
      state = advanceTurn(state)
    }
    expect(state.meta.turn).toBe(6)
    expect(state.meta.year).toBe(2028)
    expect(state.meta.month).toBe(1)
  })
})
