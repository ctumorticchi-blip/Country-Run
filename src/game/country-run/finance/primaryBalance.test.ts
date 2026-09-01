import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../data/initialState.ts'
import { computeDebtStabilization, computePrimaryBalance } from './primaryBalance.ts'

const economic = createInitialGameState('primary-balance-test-seed').economic

describe('M6 §35 primary balance — "solde avant paiement des intérêts de la dette"', () => {
  it('equals fiscalBalance + interestCost', () => {
    const result = computePrimaryBalance(economic)
    expect(result.primaryBalanceBn).toBeCloseTo(economic.fiscalBalance + economic.interestCost, 6)
  })

  it('a state with a bigger deficit but the same interest cost has a worse primary balance', () => {
    const worse = { ...economic, fiscalBalance: economic.fiscalBalance - 20 }
    expect(computePrimaryBalance(worse).primaryBalanceBn).toBeLessThan(computePrimaryBalance(economic).primaryBalanceBn)
  })
})

describe('M6 §36-37 debt stabilization indicator — approximate, using the debt-dynamics identity', () => {
  it('a deficit ratio well above the stabilizing ratio reports a positive gap ("debt still rising")', () => {
    const highDeficit = { ...economic, deficitRatio: 10 }
    const result = computeDebtStabilization(highDeficit)
    expect(result.gap).toBeGreaterThan(0)
  })

  it('a deficit ratio at or below the stabilizing ratio reports a gap <= 0', () => {
    // With growth ~0.9% + inflation ~1.7% and debtRatio ~120%, the stabilizing deficit is roughly (2.6/102.6)*120 ≈ 3%.
    const lowDeficit = { ...economic, deficitRatio: 1 }
    const result = computeDebtStabilization(lowDeficit)
    expect(result.gap).toBeLessThanOrEqual(0)
  })

  it('higher nominal growth lowers the stabilizing deficit requirement gap for the same deficit', () => {
    const lowGrowth = { ...economic, growth: 0.2 }
    const highGrowth = { ...economic, growth: 3 }
    expect(computeDebtStabilization(highGrowth).stabilizingDeficitRatio).toBeGreaterThan(computeDebtStabilization(lowGrowth).stabilizingDeficitRatio)
  })
})
