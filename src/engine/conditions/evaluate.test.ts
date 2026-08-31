import { describe, expect, it } from 'vitest'
import type { GameState } from '../state/gameState.ts'
import { evaluateCondition } from './evaluate.ts'
import type { Condition } from './types.ts'

function makeState(overrides?: Partial<GameState>): GameState {
  return {
    meta: { seed: 'test', turn: 5, year: 2027, month: 3, phase: 'in_progress' },
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
    policy: { activePolicies: ['pension_reform'] },
    delayedEffects: [],
    ...overrides,
  }
}

describe('evaluateCondition', () => {
  it('eq / neq compare a path against a literal', () => {
    const state = makeState()
    expect(evaluateCondition({ type: 'eq', path: 'meta.turn', value: 5 }, state)).toBe(true)
    expect(evaluateCondition({ type: 'eq', path: 'meta.turn', value: 6 }, state)).toBe(false)
    expect(evaluateCondition({ type: 'neq', path: 'meta.turn', value: 6 }, state)).toBe(true)
  })

  it('gt / gte / lt / lte compare numeric paths', () => {
    const state = makeState()
    expect(evaluateCondition({ type: 'gt', path: 'economic.unemployment', value: 9 }, state)).toBe(true)
    expect(evaluateCondition({ type: 'gt', path: 'economic.unemployment', value: 9.4 }, state)).toBe(false)
    expect(evaluateCondition({ type: 'gte', path: 'economic.unemployment', value: 9.4 }, state)).toBe(true)
    expect(evaluateCondition({ type: 'lt', path: 'economic.debtRatio', value: 120 }, state)).toBe(true)
    expect(evaluateCondition({ type: 'lte', path: 'economic.debtRatio', value: 112 }, state)).toBe(true)
  })

  it('hasPolicy checks membership in policy.activePolicies', () => {
    const state = makeState()
    expect(evaluateCondition({ type: 'hasPolicy', policyId: 'pension_reform' }, state)).toBe(true)
    expect(evaluateCondition({ type: 'hasPolicy', policyId: 'unknown_policy' }, state)).toBe(false)
  })

  it('and requires every child condition to hold', () => {
    const state = makeState()
    const condition: Condition = {
      type: 'and',
      conditions: [
        { type: 'gt', path: 'economic.unemployment', value: 9 },
        { type: 'gte', path: 'meta.turn', value: 5 },
      ],
    }
    expect(evaluateCondition(condition, state)).toBe(true)

    const failing: Condition = {
      type: 'and',
      conditions: [
        { type: 'gt', path: 'economic.unemployment', value: 9 },
        { type: 'gte', path: 'meta.turn', value: 8 },
      ],
    }
    expect(evaluateCondition(failing, state)).toBe(false)
  })

  it('or requires at least one child condition to hold', () => {
    const state = makeState()
    const condition: Condition = {
      type: 'or',
      conditions: [
        { type: 'gte', path: 'meta.turn', value: 8 },
        { type: 'hasPolicy', policyId: 'pension_reform' },
      ],
    }
    expect(evaluateCondition(condition, state)).toBe(true)
  })

  it('not inverts its child condition', () => {
    const state = makeState()
    expect(evaluateCondition({ type: 'not', condition: { type: 'hasPolicy', policyId: 'pension_reform' } }, state)).toBe(false)
    expect(evaluateCondition({ type: 'not', condition: { type: 'hasPolicy', policyId: 'unknown_policy' } }, state)).toBe(true)
  })

  it('conditions compose into arbitrarily nested trees', () => {
    const state = makeState()
    const condition: Condition = {
      type: 'and',
      conditions: [
        { type: 'not', condition: { type: 'hasPolicy', policyId: 'unknown_policy' } },
        {
          type: 'or',
          conditions: [
            { type: 'lt', path: 'social.socialTension', value: 10 },
            { type: 'gte', path: 'political.popularity', value: 40 },
          ],
        },
      ],
    }
    expect(evaluateCondition(condition, state)).toBe(true)
  })
})
