import { describe, expect, it } from 'vitest'
import {
  arcHasChoice,
  latestMemoryForArc,
  memoriesForArc,
  memoriesForEvent,
  memoriesWithTag,
  recordEventMemory,
  turnsSinceTag,
  type EventMemory,
} from './memory.ts'

const M1: EventMemory = { arcId: 'industrial', eventId: 'industrial-crisis-opening', turn: 3, choiceId: 'subsidize', tags: ['industrial', 'crisis'] }
const M2: EventMemory = { arcId: 'industrial', eventId: 'industrial-crisis-followup', turn: 9, choiceId: 'success', tags: ['industrial'] }
const M3: EventMemory = { eventId: 'tax-windfall', turn: 5, choiceId: 'spend-windfall', tags: ['economy'] }

describe('recordEventMemory', () => {
  it('appends without mutating the original array', () => {
    const original: EventMemory[] = [M1]
    const next = recordEventMemory(original, M2)
    expect(original).toHaveLength(1)
    expect(next).toEqual([M1, M2])
  })
})

describe('memoriesForArc / memoriesForEvent / memoriesWithTag', () => {
  const all = [M1, M2, M3]

  it('memoriesForArc filters by arcId, in append order', () => {
    expect(memoriesForArc(all, 'industrial')).toEqual([M1, M2])
    expect(memoriesForArc(all, 'unknown-arc')).toEqual([])
  })

  it('memoriesForEvent filters by exact event id', () => {
    expect(memoriesForEvent(all, 'tax-windfall')).toEqual([M3])
  })

  it('memoriesWithTag filters across arcs/events', () => {
    expect(memoriesWithTag(all, 'industrial')).toEqual([M1, M2])
    expect(memoriesWithTag(all, 'crisis')).toEqual([M1])
  })
})

describe('latestMemoryForArc', () => {
  it('returns the most recently appended memory for the arc', () => {
    expect(latestMemoryForArc([M1, M2], 'industrial')).toEqual(M2)
  })

  it('returns null when the arc has never fired', () => {
    expect(latestMemoryForArc([M1, M2], 'health')).toBeNull()
  })
})

describe('arcHasChoice', () => {
  it('true when any episode of the arc recorded that choice id', () => {
    expect(arcHasChoice([M1, M2], 'industrial', 'subsidize')).toBe(true)
    expect(arcHasChoice([M1, M2], 'industrial', 'refuse')).toBe(false)
  })
})

describe('turnsSinceTag', () => {
  it('computes turns elapsed since the most recent matching memory', () => {
    expect(turnsSinceTag([M1, M2], 'industrial', 15)).toBe(15 - 9)
  })

  it('returns Infinity when the tag never occurred', () => {
    expect(turnsSinceTag([M1, M2], 'never-seen', 15)).toBe(Infinity)
  })
})
