import { describe, expect, it } from 'vitest'
import { budgetRejectionShock, BUDGET_REJECTION_MARKET_CONFIDENCE_HIT } from './budgetRejection.ts'

describe('budgetRejectionShock', () => {
  it('is a negative one-off marketConfidence ExternalShock, turn-scoped and unique', () => {
    const shock = budgetRejectionShock(7)
    expect(shock.confidence?.marketConfidence).toBe(BUDGET_REJECTION_MARKET_CONFIDENCE_HIT)
    expect(shock.confidence?.marketConfidence).toBeLessThan(0)
    expect(shock.id).toContain('7')
    expect(budgetRejectionShock(8).id).not.toBe(shock.id)
  })
})
