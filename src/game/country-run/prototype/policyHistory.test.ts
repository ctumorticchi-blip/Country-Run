import { describe, expect, it } from 'vitest'
import { appendPolicyHistory, type PolicyHistoryEntry } from './policyHistory.ts'

describe('appendPolicyHistory — append-only, immutable', () => {
  it('returns a new array containing the appended entry, without mutating the input', () => {
    const original: PolicyHistoryEntry[] = [{ turn: 0, sourceId: 'bercy:assume-deficit', label: 'Assumer le déficit' }]
    const entry: PolicyHistoryEntry = { turn: 0, sourceId: 'energy:energy-shield', label: 'Bouclier énergétique', category: 'purchasingPower', amount: 15 }

    const next = appendPolicyHistory(original, entry)

    expect(next).not.toBe(original)
    expect(original).toHaveLength(1)
    expect(next).toHaveLength(2)
    expect(next[1]).toEqual(entry)
  })

  it('is a plain serializable array of plain objects', () => {
    const history = appendPolicyHistory([], { turn: 1, sourceId: 'budget:health', label: 'Santé — invest', category: 'health', amount: 10 })
    expect(JSON.parse(JSON.stringify(history))).toEqual(history)
  })
})
