import { describe, expect, it } from 'vitest'
import {
  activeLedgerEntries,
  dueLedgerExpirations,
  expirationPolicyEffect,
  ledgerEntriesFromFinanceChanges,
  ledgerEntryFromSource,
  structuralRevenueChange,
  sumActiveLedgerPolicyEffect,
} from './fiscalLedger.ts'
import { computeFinanceChanges, NEUTRAL_FINANCE_LEVELS } from './financeEffects.ts'

describe('M6 §40-41 fiscal ledger — reconciles exactly with the policy inputs it explains', () => {
  it('an adopted budget change produces one active ledger entry whose policyEffect matches the change', () => {
    const changes = computeFinanceChanges({ ...NEUTRAL_FINANCE_LEVELS.spending, health: 'hospitalPlan' }, NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.revenue, NEUTRAL_FINANCE_LEVELS.revenue)
    const entries = ledgerEntriesFromFinanceChanges(changes, 7, 'Budget 2028')
    expect(entries).toHaveLength(1)
    expect(entries[0].policyEffect).toEqual({ currentSpendingChanges: 10 })
    expect(entries[0].startTurn).toBe(8) // hospitalPlan's implementationTiming is 1, so nextYearStartTurn(7) + 1
  })

  it('respects each change\'s OWN implementationTiming — a delayed tier (e.g. pensions structural) starts later than an immediate one', () => {
    const changes = computeFinanceChanges(
      { ...NEUTRAL_FINANCE_LEVELS.spending, health: 'controlSpending', pensions: 'structural' },
      NEUTRAL_FINANCE_LEVELS.spending,
      NEUTRAL_FINANCE_LEVELS.revenue,
      NEUTRAL_FINANCE_LEVELS.revenue,
    )
    const entries = ledgerEntriesFromFinanceChanges(changes, 7, 'Budget 2028')
    const health = entries.find((e) => e.sourceId.includes('health'))
    const pensions = entries.find((e) => e.sourceId.includes('pensions'))
    expect(health?.startTurn).toBe(7) // controlSpending: implementationTiming 0
    expect(pensions?.startTurn).toBe(12) // structural: implementationTiming 5
  })

  it('sumActiveLedgerPolicyEffect at a turn before startTurn is empty; at/after startTurn it matches the entry', () => {
    const changes = computeFinanceChanges({ ...NEUTRAL_FINANCE_LEVELS.spending, defense: 'majorIncrease' }, NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.revenue, NEUTRAL_FINANCE_LEVELS.revenue)
    const entries = ledgerEntriesFromFinanceChanges(changes, 7, 'Budget 2028') // defense: implementationTiming 1 -> startTurn 8
    expect(sumActiveLedgerPolicyEffect(entries, 7)).toEqual({})
    expect(sumActiveLedgerPolicyEffect(entries, 8).currentSpendingChanges).toBe(14)
    expect(sumActiveLedgerPolicyEffect(entries, 30).currentSpendingChanges).toBe(14)
  })

  it('activeLedgerEntries excludes an entry once its endTurn has passed', () => {
    const temporary = ledgerEntryFromSource({
      sourceId: 'event:test:temp',
      label: 'Mesure temporaire',
      annualAmount: 3,
      startTurn: 5,
      endTurn: 11,
      category: 'REVENUE',
      originType: 'EVENT',
      policyEffect: { taxChanges: 3 },
    })
    expect(activeLedgerEntries([temporary], 5)).toHaveLength(1)
    expect(activeLedgerEntries([temporary], 10)).toHaveLength(1)
    expect(activeLedgerEntries([temporary], 11)).toHaveLength(0)
  })
})

describe('M6 §39 temporary policy expiration — reversed automatically, exactly once, on its own endTurn', () => {
  it('worked example (M6 §39): a temporary +3 measure for 6 turns is reversed by -3 exactly once, on turn endTurn', () => {
    const entry = ledgerEntryFromSource({
      sourceId: 'event:tax-shortfall:temporary-tax',
      label: 'Mesure fiscale temporaire',
      annualAmount: -3,
      startTurn: 5,
      endTurn: 11,
      category: 'REVENUE',
      originType: 'EVENT',
      policyEffect: { taxChanges: 3, householdTaxImpulse: 3 },
    })
    const ledger = [entry]

    expect(dueLedgerExpirations(ledger, 10)).toHaveLength(0)
    const due = dueLedgerExpirations(ledger, 11)
    expect(due).toHaveLength(1)
    expect(expirationPolicyEffect(due)).toEqual({ taxChanges: -3, householdTaxImpulse: -3 })

    // Checking again one turn later must NOT re-fire (endTurn matches exactly once).
    expect(dueLedgerExpirations(ledger, 12)).toHaveLength(0)
  })

  it('a PERMANENT entry (endTurn null) never appears in dueLedgerExpirations', () => {
    const permanent = ledgerEntryFromSource({
      sourceId: 'budget:health:Budget 2028',
      label: 'Plan hôpital',
      annualAmount: 10,
      startTurn: 7,
      category: 'SPENDING',
      originType: 'BUDGET',
      policyEffect: { currentSpendingChanges: 10 },
    })
    for (const turn of [7, 8, 30]) expect(dueLedgerExpirations([permanent], turn)).toHaveLength(0)
  })
})

describe('structuralRevenueChange — ledger-driven (policy) revenue change over a window of turns', () => {
  it('a revenue-raising change (ledger-negative annualAmount) reads as a positive structural change', () => {
    const changes = computeFinanceChanges(NEUTRAL_FINANCE_LEVELS.spending, NEUTRAL_FINANCE_LEVELS.spending, { ...NEUTRAL_FINANCE_LEVELS.revenue, householdTax: 'targetedIncrease' }, NEUTRAL_FINANCE_LEVELS.revenue)
    const entries = ledgerEntriesFromFinanceChanges(changes, 7, 'Budget 2028') // targetedIncrease has implementationTiming 1 -> startTurn 8
    expect(structuralRevenueChange(entries, 7, 8)).toBeGreaterThan(0)
  })
})
