import { describe, expect, it } from 'vitest'
import { createDeal, markDealFulfilled } from '../parliament/politicalDeal.ts'
import {
  applyTensionDelta,
  tensionDeltaFromBrokenDeals,
  tensionDeltaFromCompromise,
  tensionDeltaFromPopularity,
  tensionDeltaFromVoteOutcome,
} from './governmentTensionV2.ts'

describe('tensionDeltaFromVoteOutcome (M5 §20)', () => {
  it('a passing vote relieves tension', () => {
    expect(tensionDeltaFromVoteOutcome(true, 0.3)).toBeLessThan(0)
  })

  it('a defeat raises tension, more so for a more controversial ("major") defeat', () => {
    expect(tensionDeltaFromVoteOutcome(false, 0.2)).toBeGreaterThan(0)
    expect(tensionDeltaFromVoteOutcome(false, 0.9)).toBeGreaterThan(tensionDeltaFromVoteOutcome(false, 0.2))
  })
})

describe('tensionDeltaFromBrokenDeals', () => {
  const deal = createDeal({
    blocId: 'bloc-a',
    billId: 'bill-1',
    turn: 1,
    concessions: [],
    expectedVotes: 20,
    relationshipEffect: 2,
    fiscalImpact: 0,
    policyImpact: {},
  })

  it('a deal never resolved (still fulfilled: false) counts as broken', () => {
    expect(tensionDeltaFromBrokenDeals([deal])).toBeGreaterThan(0)
  })

  it('a deal marked fulfilled does not raise tension', () => {
    const fulfilled = markDealFulfilled(deal, true)
    expect(tensionDeltaFromBrokenDeals([fulfilled])).toBe(0)
  })

  it('more broken deals raise tension more', () => {
    const secondDeal = createDeal({ ...deal, blocId: 'bloc-b' })
    expect(tensionDeltaFromBrokenDeals([deal, secondDeal])).toBeGreaterThan(tensionDeltaFromBrokenDeals([deal]))
  })
})

describe('tensionDeltaFromCompromise', () => {
  it('no relief on a defeat, even with concessions used', () => {
    expect(tensionDeltaFromCompromise(3, false)).toBe(0)
  })

  it('no relief on a pass with zero concessions used', () => {
    expect(tensionDeltaFromCompromise(0, true)).toBe(0)
  })

  it('relief on a pass that used real concessions, capped', () => {
    expect(tensionDeltaFromCompromise(2, true)).toBeLessThan(0)
    expect(tensionDeltaFromCompromise(50, true)).toBe(tensionDeltaFromCompromise(4, true))
  })
})

describe('tensionDeltaFromPopularity', () => {
  it('relieves tension at high popularity, strains it at low popularity, neutral in between', () => {
    expect(tensionDeltaFromPopularity(80)).toBeLessThan(0)
    expect(tensionDeltaFromPopularity(10)).toBeGreaterThan(0)
    expect(tensionDeltaFromPopularity(50)).toBe(0)
  })
})

describe('applyTensionDelta', () => {
  it('clamps to [0, 100]', () => {
    expect(applyTensionDelta(98, 20)).toBeLessThanOrEqual(100)
    expect(applyTensionDelta(2, -20)).toBeGreaterThanOrEqual(0)
  })
})
