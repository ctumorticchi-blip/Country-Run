import { describe, expect, it } from 'vitest'
import { BILL_CATALOG, getBillDefinition } from './bills.ts'

describe('BILL_CATALOG — the 4 discretionary Year 1 bills (M4 §30-31)', () => {
  it('has exactly 4 bills with unique ids', () => {
    expect(BILL_CATALOG).toHaveLength(4)
    expect(new Set(BILL_CATALOG.map((b) => b.id)).size).toBe(4)
  })

  it('getBillDefinition resolves every catalog entry and throws on an unknown id', () => {
    for (const bill of BILL_CATALOG) {
      expect(getBillDefinition(bill.id)).toBe(bill)
    }
    expect(() => getBillDefinition('not-a-real-bill')).toThrow()
  })

  it('every bill links to at least one real promise id', () => {
    const knownPromiseIds = ['hospital-plan', 'invest-education', 'cut-business-taxes', 'energy-transition']
    for (const bill of BILL_CATALOG) {
      expect(bill.promiseLinks.length).toBeGreaterThan(0)
      for (const id of bill.promiseLinks) {
        expect(knownPromiseIds).toContain(id)
      }
    }
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
})
