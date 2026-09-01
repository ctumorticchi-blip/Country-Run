import { describe, expect, it } from 'vitest'
import { createDeal, markDealFulfilled } from './politicalDeal.ts'

describe('PoliticalDeal — serializable negotiation record (M4 §15)', () => {
  it('createDeal builds a stable id from bill/bloc/turn and starts unfulfilled', () => {
    const deal = createDeal({
      blocId: 'REFORM_CENTER',
      billId: 'budget-bill',
      turn: 0,
      concessions: ['REDUCE_SPENDING_CAP'],
      expectedVotes: 90,
      relationshipEffect: 6,
      fiscalImpact: -4,
      policyImpact: { fiscalDiscipline: 0.4 },
    })
    expect(deal.id).toBe('budget-bill:REFORM_CENTER:t0')
    expect(deal.fulfilled).toBe(false)
  })

  it('markDealFulfilled returns a new object with the flag set, without mutating the original', () => {
    const deal = createDeal({
      blocId: 'REFORM_CENTER',
      billId: 'budget-bill',
      turn: 0,
      concessions: [],
      expectedVotes: 90,
      relationshipEffect: 6,
      fiscalImpact: 0,
      policyImpact: {},
    })
    const fulfilled = markDealFulfilled(deal, true)
    expect(deal.fulfilled).toBe(false)
    expect(fulfilled.fulfilled).toBe(true)
    expect(fulfilled).not.toBe(deal)
  })

  it('is plain, JSON-serializable data', () => {
    const deal = createDeal({
      blocId: 'REFORM_CENTER',
      billId: 'budget-bill',
      turn: 0,
      concessions: ['CUT_BUSINESS_TAX'],
      expectedVotes: 90,
      relationshipEffect: 6,
      fiscalImpact: 3,
      policyImpact: { businessTax: -0.5 },
    })
    expect(JSON.parse(JSON.stringify(deal))).toEqual(deal)
  })
})
