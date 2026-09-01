import { describe, expect, it } from 'vitest'
import { computeFinanceChanges, NEUTRAL_FINANCE_LEVELS } from '../finance/financeEffects.ts'
import type { RevenueBlockId, SpendingBlockId } from '../finance/financeTypes.ts'
import { BUDGET_BILL_ID, deriveBudgetBill } from './budgetBillDerivation.ts'

const NEUTRAL_SPENDING = NEUTRAL_FINANCE_LEVELS.spending
const NEUTRAL_REVENUE = NEUTRAL_FINANCE_LEVELS.revenue

function changesFor(spending: Partial<Record<SpendingBlockId, string>> = {}, revenue: Partial<Record<RevenueBlockId, string>> = {}) {
  return computeFinanceChanges({ ...NEUTRAL_SPENDING, ...spending }, NEUTRAL_SPENDING, { ...NEUTRAL_REVENUE, ...revenue }, NEUTRAL_REVENUE)
}

describe('deriveBudgetBill — derived live from the full M6 finance model (M4 §21-22, M6 §52)', () => {
  it('a fully neutral, unchanged budget has zero marginal fiscal cost and no changes', () => {
    const bill = deriveBudgetBill([], 'Budget 2028')
    expect(bill.fiscalCost).toBe(0)
    expect(bill.id).toBe(BUDGET_BILL_ID)
    expect(bill.title).toBe('Budget 2028')
  })

  it('fiscalCost reflects the MARGINAL change this cycle, not the total stance (M6 §1 anti-accumulation)', () => {
    const keptSame = computeFinanceChanges({ ...NEUTRAL_SPENDING, health: 'hospitalPlan' }, { ...NEUTRAL_SPENDING, health: 'hospitalPlan' }, NEUTRAL_REVENUE, NEUTRAL_REVENUE)
    expect(keptSame).toHaveLength(0) // kept at the same tier => no change recorded at all
    expect(deriveBudgetBill(keptSame, 'Budget 2029').fiscalCost).toBe(0)

    const raised = changesFor({ health: 'majorRebuild' })
    expect(deriveBudgetBill(raised, 'Budget 2028').fiscalCost).toBeGreaterThan(0)
  })

  it('an expansionary spending stance reads as bad for fiscal discipline', () => {
    const bill = deriveBudgetBill(changesFor({ health: 'hospitalPlan', education: 'invest', defense: 'majorIncrease' }), 'Budget 2028')
    expect(bill.fiscalCost).toBeGreaterThan(0)
    expect(bill.policyTags.fiscalDiscipline ?? 0).toBeLessThan(0)
  })

  it('an austerity stance (cuts across several blocks) reads as fiscally disciplined', () => {
    const bill = deriveBudgetBill(changesFor({ health: 'efficiencyDrive', education: 'cuts', defense: 'cuts', administration: 'deepCuts' }), 'Budget 2028')
    expect(bill.fiscalCost).toBeLessThan(0)
    expect(bill.policyTags.fiscalDiscipline ?? 0).toBeGreaterThan(0)
  })

  it('a health-invest stance reads favorably on the health dimension specifically', () => {
    const bill = deriveBudgetBill(changesFor({ health: 'hospitalPlan' }), 'Budget 2028')
    expect(bill.policyTags.health ?? 0).toBeGreaterThan(0)
  })

  it('a household-tax rise reads as raising the householdTax dimension (native sign, not the ledger-flipped one)', () => {
    const bill = deriveBudgetBill(changesFor({}, { householdTax: 'targetedIncrease' }), 'Budget 2028')
    expect(bill.policyTags.householdTax ?? 0).toBeGreaterThan(0)
    const cutBill = deriveBudgetBill(changesFor({}, { householdTax: 'targetedCut' }), 'Budget 2028')
    expect(cutBill.policyTags.householdTax ?? 0).toBeLessThan(0)
  })

  it('changing more blocks in one cycle is more controversial than changing fewer', () => {
    const a = deriveBudgetBill(changesFor({ health: 'hospitalPlan' }), 'Budget 2028')
    const b = deriveBudgetBill(
      changesFor({ health: 'hospitalPlan', education: 'invest', defense: 'cuts', administration: 'deepCuts' }, { householdTax: 'majorIncrease' }),
      'Budget 2028',
    )
    expect(b.controversy).toBeGreaterThan(a.controversy)
  })

  it('offers all 6 concession types', () => {
    const bill = deriveBudgetBill([], 'Budget 2028')
    expect(bill.concessionsAvailable).toHaveLength(6)
  })

  it('the same inputs always derive an identical bill (pure function)', () => {
    const changes = changesFor({ health: 'hospitalPlan', education: 'cuts', defense: 'majorIncrease' }, { householdTax: 'targetedCut' })
    const a = deriveBudgetBill(changes, 'Budget 2028')
    const b = deriveBudgetBill(changes, 'Budget 2028')
    expect(a).toEqual(b)
  })

  it('pension, revenue, and consumption-tax tiers actually schedule the M6 revenue fix — economicPolicyEffect touches taxChanges/transfersChanges', () => {
    const bill = deriveBudgetBill(changesFor({ pensions: 'targeted' }, { householdTax: 'targetedIncrease', consumptionTax: 'targetedIncrease' }), 'Budget 2028')
    expect(bill.economicPolicyEffect.transfersChanges).toBeLessThan(0)
    expect(bill.economicPolicyEffect.taxChanges).toBeGreaterThan(0)
    expect(bill.economicPolicyEffect.householdTaxImpulse).toBeDefined()
  })
})
