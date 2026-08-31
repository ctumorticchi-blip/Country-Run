import { describe, expect, it } from 'vitest'
import { computePolicyDelta } from './policyDelta.ts'
import { NEUTRAL_POLICY_INPUT } from './types.ts'

describe('computePolicyDelta', () => {
  it('is all-zero when the policy stance is unchanged from the previous turn', () => {
    const stance = { ...NEUTRAL_POLICY_INPUT, publicInvestmentChanges: 20, researchInvestment: 8 }
    const delta = computePolicyDelta(stance, stance)
    expect(delta).toEqual(NEUTRAL_POLICY_INPUT)
  })

  it('returns the full value on the turn a policy first switches on from neutral', () => {
    const stance = { ...NEUTRAL_POLICY_INPUT, publicInvestmentChanges: 20 }
    const delta = computePolicyDelta(stance, NEUTRAL_POLICY_INPUT)
    expect(delta.publicInvestmentChanges).toBe(20)
  })

  it('returns only the incremental change when a sustained policy is strengthened further', () => {
    const previous = { ...NEUTRAL_POLICY_INPUT, researchInvestment: 8 }
    const current = { ...NEUTRAL_POLICY_INPUT, researchInvestment: 12 }
    const delta = computePolicyDelta(current, previous)
    expect(delta.researchInvestment).toBe(4)
  })

  it('returns a negative delta when a policy is scaled back or reversed', () => {
    const previous = { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 20 }
    const current = NEUTRAL_POLICY_INPUT
    const delta = computePolicyDelta(current, previous)
    expect(delta.currentSpendingChanges).toBe(-20)
  })

  it('computes every field independently', () => {
    const previous = { ...NEUTRAL_POLICY_INPUT, taxChanges: 5, laborMarketReform: 0.2 }
    const current = { ...NEUTRAL_POLICY_INPUT, taxChanges: 5, laborMarketReform: 0.5, publicSectorReform: 1 }
    const delta = computePolicyDelta(current, previous)
    expect(delta.taxChanges).toBe(0)
    expect(delta.laborMarketReform).toBeCloseTo(0.3)
    expect(delta.publicSectorReform).toBe(1)
  })
})
