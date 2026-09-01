import { describe, expect, it } from 'vitest'
import { adjustRelation, getRelation, MAX_RELATION, MIN_RELATION } from './blocRelations.ts'

describe('blocRelations — bloc-level memory, bounded [-100, 100]', () => {
  it('getRelation defaults to 0 for an unseen bloc', () => {
    expect(getRelation({}, 'REFORM_CENTER')).toBe(0)
  })

  it('adjustRelation is immutable — returns a new object, never mutates the input', () => {
    const before = { REFORM_CENTER: 10 }
    const after = adjustRelation(before, 'REFORM_CENTER', 5)
    expect(before).toEqual({ REFORM_CENTER: 10 })
    expect(after).toEqual({ REFORM_CENTER: 15 })
  })

  it('a zero delta is a true no-op (same reference)', () => {
    const relations = { REFORM_CENTER: 10 }
    expect(adjustRelation(relations, 'REFORM_CENTER', 0)).toBe(relations)
  })

  it('never exceeds MAX_RELATION or drops below MIN_RELATION', () => {
    let relations = adjustRelation({}, 'A', 1000)
    expect(getRelation(relations, 'A')).toBe(MAX_RELATION)
    relations = adjustRelation({}, 'B', -1000)
    expect(getRelation(relations, 'B')).toBe(MIN_RELATION)
  })

  it('accumulates across repeated adjustments', () => {
    let relations = adjustRelation({}, 'REFORM_CENTER', 6)
    relations = adjustRelation(relations, 'REFORM_CENTER', 6)
    expect(getRelation(relations, 'REFORM_CENTER')).toBe(12)
  })
})
