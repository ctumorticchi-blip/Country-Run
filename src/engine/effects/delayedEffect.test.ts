import { describe, expect, it } from 'vitest'
import type { GameState } from '../state/gameState.ts'
import { resolveDueDelayedEffects, scheduleDelayedEffect } from './delayedEffect.ts'

function makeState(overrides?: Partial<GameState>): GameState {
  return {
    meta: { seed: 'test', turn: 4, year: 2027, month: 7, phase: 'in_progress' },
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

describe('scheduleDelayedEffect', () => {
  it('registers the delayed effect in the queue without mutating the input state', () => {
    const state = makeState()
    const next = scheduleDelayedEffect(state, {
      id: 'reform-productivity-boost',
      effect: { type: 'add', path: 'economic.growth', value: 0.3 },
      executeAtTurn: 10,
      sourceId: 'reform_pension',
    })

    expect(state.delayedEffects).toEqual([])
    expect(next.delayedEffects).toHaveLength(1)
    expect(next.delayedEffects[0]?.executeAtTurn).toBe(10)
  })
})

describe('resolveDueDelayedEffects', () => {
  it('applies effects whose executeAtTurn has been reached, and removes them from the queue', () => {
    const state = makeState({
      delayedEffects: [
        { id: 'due-now', effect: { type: 'add', path: 'political.popularity', value: 5 }, executeAtTurn: 4 },
      ],
    })

    const next = resolveDueDelayedEffects(state)

    expect(next.political.popularity).toBe(50)
    expect(next.delayedEffects).toEqual([])
  })

  it('applies effects due on an earlier turn too (executeAtTurn <= current turn)', () => {
    const state = makeState({
      delayedEffects: [
        { id: 'overdue', effect: { type: 'add', path: 'political.popularity', value: 5 }, executeAtTurn: 2 },
      ],
    })

    const next = resolveDueDelayedEffects(state)

    expect(next.political.popularity).toBe(50)
    expect(next.delayedEffects).toEqual([])
  })

  it('leaves effects that are not yet due in the queue, untouched', () => {
    const notYetDue = { id: 'later', effect: { type: 'add' as const, path: 'political.popularity', value: 5 }, executeAtTurn: 10 }
    const state = makeState({ delayedEffects: [notYetDue] })

    const next = resolveDueDelayedEffects(state)

    expect(next.political.popularity).toBe(45)
    expect(next.delayedEffects).toEqual([notYetDue])
  })

  it('applies only the due effects and keeps the rest pending, in one pass', () => {
    const state = makeState({
      delayedEffects: [
        { id: 'due', effect: { type: 'add', path: 'political.popularity', value: 5 }, executeAtTurn: 4 },
        { id: 'not-due', effect: { type: 'add', path: 'political.popularity', value: 100 }, executeAtTurn: 5 },
      ],
    })

    const next = resolveDueDelayedEffects(state)

    expect(next.political.popularity).toBe(50)
    expect(next.delayedEffects).toHaveLength(1)
    expect(next.delayedEffects[0]?.id).toBe('not-due')
  })

  it('is a no-op (returns the same state) when nothing is due', () => {
    const notYetDue = { id: 'later', effect: { type: 'add' as const, path: 'political.popularity', value: 5 }, executeAtTurn: 10 }
    const state = makeState({ delayedEffects: [notYetDue] })

    const next = resolveDueDelayedEffects(state)

    expect(next).toBe(state)
  })

  it('never mutates the original state', () => {
    const state = makeState({
      delayedEffects: [
        { id: 'due-now', effect: { type: 'add', path: 'political.popularity', value: 5 }, executeAtTurn: 4 },
      ],
    })
    const snapshot = JSON.parse(JSON.stringify(state)) as GameState

    resolveDueDelayedEffects(state)

    expect(state).toEqual(snapshot)
  })
})
