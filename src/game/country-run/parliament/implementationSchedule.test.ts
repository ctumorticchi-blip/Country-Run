import { describe, expect, it } from 'vitest'
import { dueImplementations, pendingImplementations, scheduleImplementation, type ScheduledImplementation } from './implementationSchedule.ts'

function entry(overrides: Partial<ScheduledImplementation> = {}): ScheduledImplementation {
  return { sourceId: 'bill-1', label: 'Bill 1', adoptedTurn: 5, scheduledTurn: 7, policyEffect: { currentSpendingChanges: 5 }, ...overrides }
}

describe('scheduleImplementation (M5 §38)', () => {
  it('appends without mutating the original queue', () => {
    const original: ScheduledImplementation[] = []
    const next = scheduleImplementation(original, entry())
    expect(original).toHaveLength(0)
    expect(next).toHaveLength(1)
  })
})

describe('dueImplementations / pendingImplementations', () => {
  it('an entry is due exactly at its scheduledTurn, not before', () => {
    const schedule = [entry({ scheduledTurn: 7 })]
    expect(dueImplementations(schedule, 6)).toHaveLength(0)
    expect(dueImplementations(schedule, 7)).toHaveLength(1)
  })

  it('an entry stays due on any later turn too (caller is expected to remove it once applied)', () => {
    const schedule = [entry({ scheduledTurn: 7 })]
    expect(dueImplementations(schedule, 10)).toHaveLength(1)
  })

  it('due + pending always partition the full schedule with no overlap and no loss', () => {
    const schedule = [entry({ sourceId: 'a', scheduledTurn: 5 }), entry({ sourceId: 'b', scheduledTurn: 8 }), entry({ sourceId: 'c', scheduledTurn: 12 })]
    const due = dueImplementations(schedule, 8)
    const pending = pendingImplementations(schedule, 8)
    expect(due.map((e) => e.sourceId).sort()).toEqual(['a', 'b'])
    expect(pending.map((e) => e.sourceId)).toEqual(['c'])
    expect(due.length + pending.length).toBe(schedule.length)
  })

  it('applying due then replacing the queue with pending removes each entry exactly once across successive turns', () => {
    let schedule: ScheduledImplementation[] = [entry({ sourceId: 'a', scheduledTurn: 6 })]
    // Turn 6: due, applied, removed.
    expect(dueImplementations(schedule, 6)).toHaveLength(1)
    schedule = pendingImplementations(schedule, 6)
    expect(schedule).toHaveLength(0)
    // Turn 7: nothing left to apply again.
    expect(dueImplementations(schedule, 7)).toHaveLength(0)
  })
})
