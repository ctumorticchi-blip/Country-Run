import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../data/initialState.ts'
import {
  computeBudgetEquation,
  computeFinanceChanges,
  DEBT_INTEREST_BASELINE,
  diffPolicyEffect,
  NEUTRAL_FINANCE_LEVELS,
  otherRevenueEstimate,
  policyHistoryEntriesFromFinanceChanges,
  REVENUE_BASELINE_TOTAL,
  SPENDING_BASELINE_TOTAL,
  sumFinanceChangeEffects,
} from './financeEffects.ts'
import { REVENUE_BLOCK_ORDER } from './revenueBlocks.ts'
import { SPENDING_BLOCK_ORDER } from './spendingBlocks.ts'

const economic = createInitialGameState('finance-test-seed').economic

describe('M6 §6/§19 reconciliation — the 9 spending / 4+1 revenue baselines sum to the calibrated France 2027 starting state', () => {
  it('spending baselines (9 blocks + debt interest) reconcile to publicSpending, with a small documented residual', () => {
    expect(Math.abs(SPENDING_BASELINE_TOTAL - economic.publicSpending)).toBeLessThan(5)
  })

  it('DEBT_INTEREST_BASELINE is close to the calibrated interestCost (display reference, not fed to the engine)', () => {
    expect(Math.abs(DEBT_INTEREST_BASELINE - economic.interestCost)).toBeLessThan(2)
  })

  it('revenue baselines (4 controllable blocks + other) sum EXACTLY to publicRevenue', () => {
    expect(REVENUE_BASELINE_TOTAL).toBe(economic.publicRevenue)
  })

  it('no spending block double-counts debt interest — none of the 9 blocks reference interestCost/effectiveDebtRate at all', () => {
    for (const id of SPENDING_BLOCK_ORDER) {
      expect(id).not.toMatch(/interest|debt/i)
    }
  })
})

describe('M6 §1/§73 anti-accumulation — re-selecting the SAME tier across consecutive budgets contributes nothing further', () => {
  it('computeFinanceChanges is empty when nothing changed', () => {
    const changes = computeFinanceChanges(NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.revenue, NEUTRAL_FINANCE_LEVELS.revenue)
    expect(changes).toHaveLength(0)
  })

  it('worked example (M6 §73): Health +10/+10/+10 across 3 budgets — the level stays +10, never +30', () => {
    const year1 = computeFinanceChanges(
      { ...NEUTRAL_FINANCE_LEVELS.spending, health: 'hospitalPlan' },
      NEUTRAL_FINANCE_LEVELS.spending,
      NEUTRAL_FINANCE_LEVELS.revenue,
      NEUTRAL_FINANCE_LEVELS.revenue,
    )
    expect(year1.find((c) => c.blockId === 'health')?.effectDelta.currentSpendingChanges).toBe(10)

    // Year 2 and 3: the SAME tier is resubmitted — no change is recorded, so nothing further is scheduled.
    const year2 = computeFinanceChanges(
      { ...NEUTRAL_FINANCE_LEVELS.spending, health: 'hospitalPlan' },
      { ...NEUTRAL_FINANCE_LEVELS.spending, health: 'hospitalPlan' },
      NEUTRAL_FINANCE_LEVELS.revenue,
      NEUTRAL_FINANCE_LEVELS.revenue,
    )
    expect(year2.find((c) => c.blockId === 'health')).toBeUndefined()
  })

  it('the same worked example holds for household tax and pensions', () => {
    const taxChanged = computeFinanceChanges(NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.spending, { ...NEUTRAL_FINANCE_LEVELS.revenue, householdTax: 'targetedIncrease' }, NEUTRAL_FINANCE_LEVELS.revenue)
    expect(taxChanged.find((c) => c.blockId === 'householdTax')?.effectDelta.taxChanges).toBe(6)
    const taxUnchanged = computeFinanceChanges(
      NEUTRAL_FINANCE_LEVELS.spending,
      NEUTRAL_FINANCE_LEVELS.spending,
      { ...NEUTRAL_FINANCE_LEVELS.revenue, householdTax: 'targetedIncrease' },
      { ...NEUTRAL_FINANCE_LEVELS.revenue, householdTax: 'targetedIncrease' },
    )
    expect(taxUnchanged).toHaveLength(0)

    const pensionsChanged = computeFinanceChanges({ ...NEUTRAL_FINANCE_LEVELS.spending, pensions: 'targeted' }, NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.revenue, NEUTRAL_FINANCE_LEVELS.revenue)
    expect(pensionsChanged.find((c) => c.blockId === 'pensions')?.effectDelta.transfersChanges).toBe(-12)
    const pensionsUnchanged = computeFinanceChanges(
      { ...NEUTRAL_FINANCE_LEVELS.spending, pensions: 'targeted' },
      { ...NEUTRAL_FINANCE_LEVELS.spending, pensions: 'targeted' },
      NEUTRAL_FINANCE_LEVELS.revenue,
      NEUTRAL_FINANCE_LEVELS.revenue,
    )
    expect(pensionsUnchanged).toHaveLength(0)
  })

  it('reverting to a lower tier applies the correct negative delta exactly once', () => {
    const reverted = computeFinanceChanges(NEUTRAL_FINANCE_LEVELS.spending, { ...NEUTRAL_FINANCE_LEVELS.spending, health: 'hospitalPlan' }, NEUTRAL_FINANCE_LEVELS.revenue, NEUTRAL_FINANCE_LEVELS.revenue)
    expect(reverted.find((c) => c.blockId === 'health')?.effectDelta.currentSpendingChanges).toBe(-10)
  })
})

describe('M6 §1 revenue fix — every controllable tax tier feeds BOTH taxChanges (revenue) and the matching *TaxImpulse (confidence/inflation)', () => {
  it('household tax tiers set taxChanges and householdTaxImpulse to the same magnitude', () => {
    const changes = computeFinanceChanges(NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.spending, { ...NEUTRAL_FINANCE_LEVELS.revenue, householdTax: 'majorCut' }, NEUTRAL_FINANCE_LEVELS.revenue)
    const change = changes.find((c) => c.blockId === 'householdTax')
    expect(change?.effectDelta.taxChanges).toBe(-15)
    expect(change?.effectDelta.householdTaxImpulse).toBe(-15)
  })

  it('business tax tiers set taxChanges and businessTaxImpulse to the same magnitude', () => {
    const changes = computeFinanceChanges(NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.spending, { ...NEUTRAL_FINANCE_LEVELS.revenue, businessTax: 'majorIncrease' }, NEUTRAL_FINANCE_LEVELS.revenue)
    const change = changes.find((c) => c.blockId === 'businessTax')
    expect(change?.effectDelta.taxChanges).toBe(12)
    expect(change?.effectDelta.businessTaxImpulse).toBe(12)
  })

  it('social contributions tiers set taxChanges and a partial businessTaxImpulse pass-through', () => {
    const changes = computeFinanceChanges(NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.spending, { ...NEUTRAL_FINANCE_LEVELS.revenue, socialContributions: 'targetedCut' }, NEUTRAL_FINANCE_LEVELS.revenue)
    const change = changes.find((c) => c.blockId === 'socialContributions')
    expect(change?.effectDelta.taxChanges).toBe(-6)
    expect(change?.effectDelta.businessTaxImpulse).toBe(-3)
  })
})

describe('M6 §23 consumption tax — the inflation/confidence impulse is a separate TEMPORARY change, never folded into the permanent revenue change', () => {
  it('a consumption-tax rise produces 2 changes: a permanent taxChanges-only entry and a temporary householdTaxImpulse-only entry', () => {
    const changes = computeFinanceChanges(NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.spending, { ...NEUTRAL_FINANCE_LEVELS.revenue, consumptionTax: 'targetedIncrease' }, NEUTRAL_FINANCE_LEVELS.revenue)
    const consumptionChanges = changes.filter((c) => c.blockId === 'consumptionTax')
    expect(consumptionChanges).toHaveLength(2)

    const permanent = consumptionChanges.find((c) => !c.temporary)
    expect(permanent?.effectDelta.taxChanges).toBe(6)
    expect(permanent?.effectDelta.householdTaxImpulse).toBeUndefined()

    const temporary = consumptionChanges.find((c) => c.temporary)
    expect(temporary?.effectDelta.householdTaxImpulse).toBe(6)
    expect(temporary?.effectDelta.taxChanges).toBeUndefined()
    expect(temporary?.durationTurns).toBe(6)
  })
})

describe('policyHistoryEntriesFromFinanceChanges — only built from real changes, correct signs for the promise evaluators', () => {
  it('a household tax INCREASE records a POSITIVE taxation amount (native sign, not the ledger-flipped one)', () => {
    const changes = computeFinanceChanges(NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.spending, { ...NEUTRAL_FINANCE_LEVELS.revenue, householdTax: 'targetedIncrease' }, NEUTRAL_FINANCE_LEVELS.revenue)
    const entries = policyHistoryEntriesFromFinanceChanges(changes, 7, 'Budget 2028')
    const entry = entries.find((e) => e.category === 'taxation')
    expect(entry?.amount).toBe(6)
  })

  it('a pension cut records a NEGATIVE pensions amount', () => {
    const changes = computeFinanceChanges({ ...NEUTRAL_FINANCE_LEVELS.spending, pensions: 'targeted' }, NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.revenue, NEUTRAL_FINANCE_LEVELS.revenue)
    const entries = policyHistoryEntriesFromFinanceChanges(changes, 7, 'Budget 2028')
    const entry = entries.find((e) => e.category === 'pensions')
    expect(entry?.amount).toBe(-12)
  })

  it('the consumption-tax "prix transitoire" duplicate never produces its own policyHistory entry', () => {
    const changes = computeFinanceChanges(NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.spending, { ...NEUTRAL_FINANCE_LEVELS.revenue, consumptionTax: 'targetedIncrease' }, NEUTRAL_FINANCE_LEVELS.revenue)
    const entries = policyHistoryEntriesFromFinanceChanges(changes, 7, 'Budget 2028')
    expect(entries).toHaveLength(1)
  })
})

describe('otherRevenueEstimate — the residual bucket always makes the 5 revenue blocks sum to the real simulated publicRevenue', () => {
  it('at the calibrated baseline, other revenue equals its own reference baseline (nothing has changed yet)', () => {
    expect(otherRevenueEstimate(economic, NEUTRAL_FINANCE_LEVELS.revenue)).toBeCloseTo(122, 5)
  })
})

describe('computeBudgetEquation — reads straight off the real simulated EconomicState', () => {
  it('balance is exactly revenue minus spending, and %GDP figures are internally consistent', () => {
    const equation = computeBudgetEquation(economic)
    expect(equation.balanceBn).toBeCloseTo(economic.publicRevenue - economic.publicSpending, 6)
    expect(equation.revenuePctGdp).toBeCloseTo((economic.publicRevenue / economic.nominalGdp) * 100, 6)
  })
})

describe('diffPolicyEffect / sumFinanceChangeEffects', () => {
  it('diffPolicyEffect drops fields that end up at zero', () => {
    expect(diffPolicyEffect({ taxChanges: 5 }, { taxChanges: 5 })).toEqual({})
  })

  it('sumFinanceChangeEffects merges every change field-by-field', () => {
    const changes = computeFinanceChanges(
      { ...NEUTRAL_FINANCE_LEVELS.spending, health: 'hospitalPlan', defense: 'majorIncrease' },
      NEUTRAL_FINANCE_LEVELS.spending,
      NEUTRAL_FINANCE_LEVELS.revenue,
      NEUTRAL_FINANCE_LEVELS.revenue,
    )
    const merged = sumFinanceChangeEffects(changes)
    expect(merged.currentSpendingChanges).toBe(10 + 14)
  })
})

describe('REVENUE_BLOCK_ORDER / SPENDING_BLOCK_ORDER — exactly the counts M6 §4/§19 specify', () => {
  it('9 controllable spending blocks, 4 controllable revenue blocks', () => {
    expect(SPENDING_BLOCK_ORDER).toHaveLength(9)
    expect(REVENUE_BLOCK_ORDER).toHaveLength(4)
  })
})
