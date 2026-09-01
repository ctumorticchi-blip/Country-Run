import { describe, expect, it } from 'vitest'
import { PROMISE_CATALOG } from '../promises/promiseCatalog.ts'
import { BILL_CATALOG, getBillDefinition } from './bills.ts'

describe('BILL_CATALOG — 12 discretionary reform bills, one per gameplay year (M5 §36)', () => {
  it('has exactly 12 bills with unique ids', () => {
    expect(BILL_CATALOG).toHaveLength(12)
    expect(new Set(BILL_CATALOG.map((b) => b.id)).size).toBe(12)
  })

  it('getBillDefinition resolves every catalog entry and throws on an unknown id', () => {
    for (const bill of BILL_CATALOG) {
      expect(getBillDefinition(bill.id)).toBe(bill)
    }
    expect(() => getBillDefinition('not-a-real-bill')).toThrow()
  })

  it('every promiseLinks entry points to a real promise id (empty is allowed — not every reform is tied to a campaign promise, M5 §37)', () => {
    const knownPromiseIds = new Set(PROMISE_CATALOG.map((p) => p.id))
    for (const bill of BILL_CATALOG) {
      for (const id of bill.promiseLinks) {
        expect(knownPromiseIds).toContain(id)
      }
    }
  })

  it('at least one bill is deliberately not linked to any promise (a pure discretionary reform)', () => {
    expect(BILL_CATALOG.some((b) => b.promiseLinks.length === 0)).toBe(true)
  })

  it('every bill requires the presidential majority threshold (289)', () => {
    for (const bill of BILL_CATALOG) {
      expect(bill.voteThreshold).toBe(289)
    }
  })

  it('every bill has at least one available concession', () => {
    for (const bill of BILL_CATALOG) {
      expect(bill.concessionsAvailable.length).toBeGreaterThan(0)
    }
  })

  it('not every reform is beneficial — at least one bill trades a fiscal saving for high controversy (M5 §37)', () => {
    expect(BILL_CATALOG.some((b) => b.fiscalCost < 0 && b.controversy >= 0.7)).toBe(true)
  })

  it('every bill declares a positive implementationDelay, scheduled by the turn controller (M5 §38)', () => {
    for (const bill of BILL_CATALOG) {
      expect(bill.implementationDelay).toBeGreaterThan(0)
    }
  })
})
