import { describe, expect, it } from 'vitest'
import { NEUTRAL_BUDGET_SELECTIONS } from '../budget/budgetTypes.ts'
import { BUDGET_BILL_ID, deriveBudgetBill } from './budgetBillDerivation.ts'

describe('deriveBudgetBill — derived live from Budget Builder choices (M4 §21-22)', () => {
  it('a fully neutral budget has zero fiscal cost', () => {
    const bill = deriveBudgetBill(NEUTRAL_BUDGET_SELECTIONS)
    expect(bill.fiscalCost).toBe(0)
    expect(bill.id).toBe(BUDGET_BILL_ID)
  })

  it('an expansionary budget (all invest) has a positive fiscal cost and reads as pro-spending', () => {
    const bill = deriveBudgetBill({ health: 'invest', education: 'invest', investment: 'invest', defense: 'invest' })
    expect(bill.fiscalCost).toBeGreaterThan(0)
    expect(bill.policyTags.publicSpending ?? 0).toBeGreaterThan(0)
    expect(bill.policyTags.fiscalDiscipline ?? 0).toBeLessThan(0)
  })

  it('an austerity budget (all cut) has a negative fiscal cost and reads as fiscally disciplined', () => {
    const bill = deriveBudgetBill({ health: 'cut', education: 'cut', investment: 'cut', defense: 'cut' })
    expect(bill.fiscalCost).toBeLessThan(0)
    expect(bill.policyTags.fiscalDiscipline ?? 0).toBeGreaterThan(0)
  })

  it('a health-invest budget reads favorably on the health dimension specifically', () => {
    const bill = deriveBudgetBill({ ...NEUTRAL_BUDGET_SELECTIONS, health: 'invest' })
    expect(bill.policyTags.health ?? 0).toBeGreaterThan(0)
  })

  it('a green-leaning investment budget reads favorably on publicInvestment', () => {
    const bill = deriveBudgetBill({ ...NEUTRAL_BUDGET_SELECTIONS, investment: 'invest' })
    expect(bill.policyTags.publicInvestment ?? 0).toBeGreaterThan(0)
  })

  it('a more extreme budget (more categories touched) is more controversial than a neutral one', () => {
    const neutral = deriveBudgetBill(NEUTRAL_BUDGET_SELECTIONS)
    const extreme = deriveBudgetBill({ health: 'invest', education: 'invest', investment: 'invest', defense: 'cut' })
    expect(extreme.controversy).toBeGreaterThan(neutral.controversy)
  })

  it('offers all 6 concession types', () => {
    const bill = deriveBudgetBill(NEUTRAL_BUDGET_SELECTIONS)
    expect(bill.concessionsAvailable).toHaveLength(6)
  })

  it('the same selections always derive an identical bill (pure function)', () => {
    const a = deriveBudgetBill({ health: 'invest', education: 'cut', investment: 'maintain', defense: 'invest' })
    const b = deriveBudgetBill({ health: 'invest', education: 'cut', investment: 'maintain', defense: 'invest' })
    expect(a).toEqual(b)
  })
})
