import { describe, expect, it } from 'vitest'
import type { GameState } from '../state/gameState.ts'
import { applyEffect, applyEffects } from './apply.ts'

function makeState(overrides?: Partial<GameState>): GameState {
  return {
    meta: { seed: 'test', turn: 1, year: 2027, month: 1, phase: 'in_progress' },
    economic: {
      gdp: 2800,
      nominalGdp: 2800,
      potentialGrowth: 1.2,
      growth: 1.1,
      inflation: 2.2,
      unemployment: 9.4,
      structuralUnemployment: 9.0,
      publicRevenue: 1350,
      publicSpending: 1500,
      fiscalBalance: -150,
      deficit: 150,
      deficitRatio: 5.1,
      debt: 3200,
      debtRatio: 112,
      effectiveDebtRate: 2.2,
      interestCost: 70,
      purchasingPower: 0,
      productivityGrowth: 0.8,
      consumerConfidence: 50,
      businessConfidence: 50,
      marketConfidence: 55,
      publicSectorEfficiency: 55,
    },
    political: { popularity: 45, parliamentSeats: 289, politicalCredibility: 60 },
    social: { socialTension: 40 },
    policy: { activePolicies: [] },
    delayedEffects: [],
    ...overrides,
  }
}

describe('applyEffect', () => {
  it('set overwrites the value at the given path', () => {
    const state = makeState()
    const next = applyEffect(state, { type: 'set', path: 'political.popularity', value: 30 })
    expect(next.political.popularity).toBe(30)
  })

  it('add increases a numeric value', () => {
    const state = makeState()
    const next = applyEffect(state, { type: 'add', path: 'economic.growth', value: 0.4 })
    expect(next.economic.growth).toBeCloseTo(1.5)
  })

  it('subtract decreases a numeric value', () => {
    const state = makeState()
    const next = applyEffect(state, { type: 'subtract', path: 'political.popularity', value: 5 })
    expect(next.political.popularity).toBe(40)
  })

  it('add clamps to max when provided', () => {
    const state = makeState()
    const next = applyEffect(state, { type: 'add', path: 'political.popularity', value: 100, max: 100 })
    expect(next.political.popularity).toBe(100)
  })

  it('subtract clamps to min when provided', () => {
    const state = makeState()
    const next = applyEffect(state, { type: 'subtract', path: 'political.popularity', value: 100, min: 0 })
    expect(next.political.popularity).toBe(0)
  })

  it('addPolicy adds a policy id, and is idempotent', () => {
    const state = makeState()
    const withPolicy = applyEffect(state, { type: 'addPolicy', policyId: 'pension_reform' })
    expect(withPolicy.policy.activePolicies).toEqual(['pension_reform'])

    const stillOnlyOne = applyEffect(withPolicy, { type: 'addPolicy', policyId: 'pension_reform' })
    expect(stillOnlyOne.policy.activePolicies).toEqual(['pension_reform'])
  })

  it('removePolicy removes a policy id, and is a no-op when absent', () => {
    const state = makeState({ policy: { activePolicies: ['pension_reform'] } })
    const without = applyEffect(state, { type: 'removePolicy', policyId: 'pension_reform' })
    expect(without.policy.activePolicies).toEqual([])

    const stillEmpty = applyEffect(without, { type: 'removePolicy', policyId: 'pension_reform' })
    expect(stillEmpty.policy.activePolicies).toEqual([])
  })

  it('never mutates the original state', () => {
    const state = makeState()
    const snapshot = JSON.parse(JSON.stringify(state)) as GameState

    applyEffect(state, { type: 'set', path: 'political.popularity', value: 999 })
    applyEffect(state, { type: 'addPolicy', policyId: 'pension_reform' })

    expect(state).toEqual(snapshot)
  })

  it('applyEffects applies a sequence in order', () => {
    const state = makeState()
    const next = applyEffects(state, [
      { type: 'set', path: 'political.popularity', value: 50 },
      { type: 'add', path: 'political.popularity', value: 10 },
      { type: 'subtract', path: 'political.popularity', value: 5 },
    ])
    expect(next.political.popularity).toBe(55)
  })
})
