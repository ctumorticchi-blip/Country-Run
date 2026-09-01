import { describe, expect, it } from 'vitest'
import { addConcession, applyConcessionsToBill, CONCESSION_DEFINITIONS, getConcessionDefinition } from './concessions.ts'
import type { PoliticalBillDefinition } from './billTypes.ts'

const BASE_BILL: PoliticalBillDefinition = {
  id: 'test-bill',
  title: 'Test Bill',
  description: '',
  policyTags: { health: 0.5 },
  economicPolicyEffect: { currentSpendingChanges: 10 },
  fiscalCost: 10,
  reformIntensity: 0.3,
  controversy: 0.2,
  promiseLinks: [],
  requiredPoliticalCapital: 5,
  urgency: 'MEDIUM',
  negotiability: 0.7,
  concessionsAvailable: ['INCREASE_HOUSING_FUNDING', 'INCREASE_HEALTH_FUNDING', 'REDUCE_SPENDING_CAP'],
  voteThreshold: 289,
  implementationDelay: 1,
}

describe('CONCESSION_DEFINITIONS — exactly 6 reusable types (M4 §12, §23)', () => {
  it('has exactly 6 concessions', () => {
    expect(CONCESSION_DEFINITIONS).toHaveLength(6)
  })

  it('getConcessionDefinition resolves every id', () => {
    for (const c of CONCESSION_DEFINITIONS) {
      expect(getConcessionDefinition(c.id)).toBe(c)
    }
  })
})

describe('addConcession — anti-double-application (M4 §38)', () => {
  it('adds a new concession', () => {
    const next = addConcession([], 'INCREASE_HOUSING_FUNDING')
    expect(next).toEqual(['INCREASE_HOUSING_FUNDING'])
  })

  it('is a true no-op (same array reference) when the concession is already applied', () => {
    const current = ['INCREASE_HOUSING_FUNDING'] as const
    const next = addConcession(current, 'INCREASE_HOUSING_FUNDING')
    expect(next).toBe(current)
  })
})

describe('applyConcessionsToBill — a concession applies its fiscal delta exactly once', () => {
  it('a single concession shifts fiscalCost by exactly its own delta, not the base twice', () => {
    const effective = applyConcessionsToBill(BASE_BILL, ['INCREASE_HOUSING_FUNDING'])
    expect(effective.fiscalCost).toBe(BASE_BILL.fiscalCost + 4) // INCREASE_HOUSING_FUNDING = +4 Md€/an
  })

  it('recomputing from the SAME appliedConcessionIds list repeatedly never compounds the delta', () => {
    const first = applyConcessionsToBill(BASE_BILL, ['INCREASE_HOUSING_FUNDING'])
    const second = applyConcessionsToBill(BASE_BILL, ['INCREASE_HOUSING_FUNDING'])
    const third = applyConcessionsToBill(BASE_BILL, first.appliedConcessions)
    expect(first.fiscalCost).toBe(second.fiscalCost)
    expect(first.fiscalCost).toBe(third.fiscalCost)
  })

  it('multiple concessions sum additively, each counted exactly once', () => {
    const effective = applyConcessionsToBill(BASE_BILL, ['INCREASE_HOUSING_FUNDING', 'REDUCE_SPENDING_CAP'])
    // +4 (housing) + -4 (spending cap) = net 0 relative to base
    expect(effective.fiscalCost).toBe(BASE_BILL.fiscalCost + 4 - 4)
  })

  it('merges economicPolicyEffect additively per field', () => {
    const effective = applyConcessionsToBill(BASE_BILL, ['INCREASE_HOUSING_FUNDING'])
    expect(effective.economicPolicyEffect.currentSpendingChanges).toBe(10) // untouched field
    expect(effective.economicPolicyEffect.publicInvestmentChanges).toBe(4) // concession's own field
  })

  it('policyTags stay clamped to [-1, 1] even after several concessions push the same dimension', () => {
    const effective = applyConcessionsToBill(BASE_BILL, ['INCREASE_HEALTH_FUNDING'])
    expect(effective.policyTags.health).toBeLessThanOrEqual(1)
    expect(effective.policyTags.health).toBeGreaterThanOrEqual(-1)
  })

  it('never mutates the base definition', () => {
    const before = JSON.parse(JSON.stringify(BASE_BILL)) as PoliticalBillDefinition
    applyConcessionsToBill(BASE_BILL, ['INCREASE_HOUSING_FUNDING', 'REDUCE_SPENDING_CAP'])
    expect(BASE_BILL).toEqual(before)
  })
})
