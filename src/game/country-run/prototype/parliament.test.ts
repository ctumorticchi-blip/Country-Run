import { describe, expect, it } from 'vitest'
import { createActionRng } from './rng.ts'
import { getParliamentChoice, resolveParliamentVote, ABSOLUTE_MAJORITY, COALITION_SEATS, SEATS_MISSING } from './parliament.ts'

describe('parliament constants', () => {
  it('the coalition is short of the absolute majority by the documented amount', () => {
    expect(ABSOLUTE_MAJORITY - COALITION_SEATS).toBe(SEATS_MISSING)
    expect(SEATS_MISSING).toBe(26)
  })
})

describe('resolveParliamentVote', () => {
  it('is deterministic: the same seed and the same choice always produce the same outcome', () => {
    const choice = getParliamentChoice('negotiate')
    const run = () => resolveParliamentVote(choice, createActionRng('replay-seed', 'parliament'))
    expect(run()).toBe(run())
  })

  it('a different seed can produce a different outcome for a borderline probability', () => {
    const choice = getParliamentChoice('maintain') // 55% — close enough to 50/50 that seeds should diverge
    const outcomes = new Set(
      Array.from({ length: 30 }, (_, i) => resolveParliamentVote(choice, createActionRng(`seed-${String(i)}`, 'parliament'))),
    )
    expect(outcomes.size).toBe(2) // both 'adopted' and 'rejected' show up across enough seeds
  })

  it('a near-certain choice (concede) passes far more often than a coin-flip choice (maintain)', () => {
    const concede = getParliamentChoice('concede')
    const maintain = getParliamentChoice('maintain')

    const passRate = (choiceId: 'concede' | 'maintain') => {
      const choice = choiceId === 'concede' ? concede : maintain
      let passed = 0
      const trials = 200
      for (let i = 0; i < trials; i++) {
        if (resolveParliamentVote(choice, createActionRng(`trial-${String(i)}`, choiceId)) === 'adopted') passed++
      }
      return passed / trials
    }

    expect(passRate('concede')).toBeGreaterThan(passRate('maintain'))
  })

  it('never calls Math.random', () => {
    const originalRandom = Math.random
    let called = false
    Math.random = () => {
      called = true
      return originalRandom()
    }
    try {
      resolveParliamentVote(getParliamentChoice('negotiate'), createActionRng('purity-check', 'parliament'))
      expect(called).toBe(false)
    } finally {
      Math.random = originalRandom
    }
  })
})
