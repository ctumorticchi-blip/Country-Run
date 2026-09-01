import { describe, expect, it } from 'vitest'
import { NEUTRAL_BUDGET_LEVELS } from '../budget/budgetCategories.ts'
import type { BudgetLevels } from '../budget/budgetTypes.ts'
import { BUDGET_BILL_ID, deriveBudgetBill } from './budgetBillDerivation.ts'

describe('deriveBudgetBill — derived live from Budget Builder choices (M4 §21-22, M5 §28-29)', () => {
  it('a fully neutral, unchanged budget has zero marginal fiscal cost', () => {
    const bill = deriveBudgetBill(NEUTRAL_BUDGET_LEVELS, NEUTRAL_BUDGET_LEVELS, 'Budget 2028')
    expect(bill.fiscalCost).toBe(0)
    expect(bill.id).toBe(BUDGET_BILL_ID)
    expect(bill.title).toBe('Budget 2028')
  })

  it('fiscalCost reflects the MARGINAL change from previousLevels, not the total stance', () => {
    const previous: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 10 }
    const keptSame = deriveBudgetBill(previous, previous, 'Budget 2029')
    expect(keptSame.fiscalCost).toBe(0) // kept at +10 => delta 0, even though the total stance is +10

    const raised: BudgetLevels = { ...previous, health: 15 }
    expect(deriveBudgetBill(raised, previous, 'Budget 2029').fiscalCost).toBe(5)
  })

  it('an expansionary total stance (all categories positive) reads as pro-spending', () => {
    const levels: BudgetLevels = { health: 10, education: 8, publicInvestment: 15, defense: 10, housingTerritories: 8, greenTransition: 8, administrationEfficiency: 0 }
    const bill = deriveBudgetBill(levels, NEUTRAL_BUDGET_LEVELS, 'Budget 2028')
    expect(bill.fiscalCost).toBeGreaterThan(0)
    expect(bill.policyTags.publicSpending ?? 0).toBeGreaterThan(0)
    expect(bill.policyTags.fiscalDiscipline ?? 0).toBeLessThan(0)
  })

  it('an austerity stance (all categories negative) reads as fiscally disciplined', () => {
    const levels: BudgetLevels = { health: -10, education: -8, publicInvestment: -10, defense: -5, housingTerritories: -6, greenTransition: -4, administrationEfficiency: -12 }
    const bill = deriveBudgetBill(levels, NEUTRAL_BUDGET_LEVELS, 'Budget 2028')
    expect(bill.fiscalCost).toBeLessThan(0)
    expect(bill.policyTags.fiscalDiscipline ?? 0).toBeGreaterThan(0)
  })

  it('a health-invest stance reads favorably on the health dimension specifically', () => {
    const levels: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 10 }
    const bill = deriveBudgetBill(levels, NEUTRAL_BUDGET_LEVELS, 'Budget 2028')
    expect(bill.policyTags.health ?? 0).toBeGreaterThan(0)
  })

  it('a green-transition stance reads favorably on environment', () => {
    const levels: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, greenTransition: 8 }
    const bill = deriveBudgetBill(levels, NEUTRAL_BUDGET_LEVELS, 'Budget 2028')
    expect(bill.policyTags.environment ?? 0).toBeGreaterThan(0)
  })

  it('changing more categories in one cycle is more controversial than changing fewer', () => {
    const oneChange: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 10 }
    const manyChanges: BudgetLevels = { health: 10, education: 8, publicInvestment: 15, defense: -5, housingTerritories: 8, greenTransition: -4, administrationEfficiency: -5 }
    const a = deriveBudgetBill(oneChange, NEUTRAL_BUDGET_LEVELS, 'Budget 2028')
    const b = deriveBudgetBill(manyChanges, NEUTRAL_BUDGET_LEVELS, 'Budget 2028')
    expect(b.controversy).toBeGreaterThan(a.controversy)
  })

  it('offers all 6 concession types', () => {
    const bill = deriveBudgetBill(NEUTRAL_BUDGET_LEVELS, NEUTRAL_BUDGET_LEVELS, 'Budget 2028')
    expect(bill.concessionsAvailable).toHaveLength(6)
  })

  it('the same inputs always derive an identical bill (pure function)', () => {
    const levels: BudgetLevels = { health: 10, education: -8, publicInvestment: 0, defense: 10, housingTerritories: 0, greenTransition: 0, administrationEfficiency: -5 }
    const a = deriveBudgetBill(levels, NEUTRAL_BUDGET_LEVELS, 'Budget 2028')
    const b = deriveBudgetBill(levels, NEUTRAL_BUDGET_LEVELS, 'Budget 2028')
    expect(a).toEqual(b)
  })
})
