import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState.ts'

describe('createInitialGameState', () => {
  it('starts at turn 0 with the given seed, in the setup phase', () => {
    const state = createInitialGameState('my-seed')
    expect(state.meta.turn).toBe(0)
    expect(state.meta.seed).toBe('my-seed')
    expect(state.meta.phase).toBe('setup')
  })

  it('starts with no active policies and no delayed effects queued', () => {
    const state = createInitialGameState('my-seed')
    expect(state.policy.activePolicies).toEqual([])
    expect(state.delayedEffects).toEqual([])
  })

  it('produces an independent state object on every call', () => {
    const a = createInitialGameState('my-seed')
    const b = createInitialGameState('my-seed')
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(a.policy.activePolicies).not.toBe(b.policy.activePolicies)
  })
})

/** M6.1 blocker 1: the game must start from the documented France 2027 baseline, not the old placeholder dataset. */
describe('France 2027 baseline (M6.1 — docs/FRANCE_BASELINE_2027.md)', () => {
  const economic = createInitialGameState('baseline-check').economic

  it('does not start from the old placeholder totals (2,800 GDP / 1,372 revenue / 1,512 spending / 3,360 debt)', () => {
    expect(economic.gdp).not.toBe(2800)
    expect(economic.publicRevenue).not.toBe(1372)
    expect(economic.publicSpending).not.toBe(1512)
    expect(economic.debt).not.toBe(3360)
    expect(economic.interestCost).not.toBe(100.8)
  })

  it('starts at the documented France 2027 baseline values', () => {
    expect(economic.gdp).toBe(3150)
    expect(economic.nominalGdp).toBe(3150)
    expect(economic.publicRevenue).toBe(1638)
    expect(economic.publicSpending).toBe(1796)
    expect(economic.debt).toBe(3780)
    expect(economic.interestCost).toBe(76)
    expect(economic.effectiveDebtRate).toBe(2.0)
  })

  it('growth/inflation/unemployment match the Banque de France June 2026 2027 projection', () => {
    expect(economic.growth).toBeCloseTo(0.9, 5)
    expect(economic.inflation).toBeCloseTo(1.7, 5)
    expect(economic.unemployment).toBeCloseTo(8.1, 5)
  })

  it('publicRevenue / nominalGdp is a believable French public-revenue ratio (~52%)', () => {
    expect((economic.publicRevenue / economic.nominalGdp) * 100).toBeCloseTo(52.0, 1)
  })

  it('publicSpending / nominalGdp is a believable French public-spending ratio (~57%)', () => {
    expect((economic.publicSpending / economic.nominalGdp) * 100).toBeCloseTo(57.0, 1)
  })

  it('(publicSpending - publicRevenue) / nominalGdp matches the starting deficit ratio', () => {
    const impliedDeficitRatio = ((economic.publicSpending - economic.publicRevenue) / economic.nominalGdp) * 100
    expect(impliedDeficitRatio).toBeCloseTo(economic.deficitRatio, 1)
    expect(economic.deficitRatio).toBeCloseTo(5.0, 1)
  })

  it('debt / nominalGdp matches the starting debt ratio', () => {
    expect((economic.debt / economic.nominalGdp) * 100).toBeCloseTo(economic.debtRatio, 1)
    expect(economic.debtRatio).toBeCloseTo(120.0, 1)
  })

  it('interestCost ≈ effectiveDebtRate% × debt (never a mismatched Maastricht-vs-national-accounts multiplication)', () => {
    const impliedInterest = (economic.effectiveDebtRate / 100) * economic.debt
    expect(Math.abs(economic.interestCost - impliedInterest)).toBeLessThan(1)
  })

  it('fiscalBalance and deficit are internally consistent with revenue/spending', () => {
    expect(economic.fiscalBalance).toBeCloseTo(economic.publicRevenue - economic.publicSpending, 5)
    expect(economic.deficit).toBeCloseTo(Math.max(0, -economic.fiscalBalance), 5)
  })
})
