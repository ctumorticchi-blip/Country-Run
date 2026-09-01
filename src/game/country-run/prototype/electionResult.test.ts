import { describe, expect, it } from 'vitest'
import { computeElectionResult, MAX_ELECTION_SCORE_PCT, MIN_ELECTION_SCORE_PCT } from './electionResult.ts'

const COHERENT = ['reduce-deficit', 'reduce-debt', 'no-tax-increase', 'cut-household-taxes', 'cut-business-taxes']
const CONTRADICTORY = ['hospital-plan', 'invest-education', 'grand-investment-plan', 'energy-transition', 'strengthen-defense']

describe('computeElectionResult — always a deterministic win, bounded', () => {
  it('never falls outside [MIN_ELECTION_SCORE_PCT, MAX_ELECTION_SCORE_PCT] across many seeds and selections', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      for (const promises of [COHERENT, CONTRADICTORY]) {
        const result = computeElectionResult(seed, promises)
        expect(result.scorePct).toBeGreaterThanOrEqual(MIN_ELECTION_SCORE_PCT)
        expect(result.scorePct).toBeLessThanOrEqual(MAX_ELECTION_SCORE_PCT)
      }
    }
  })

  it('is deterministic for the same seed and selection', () => {
    const a = computeElectionResult('determinism-check', COHERENT)
    const b = computeElectionResult('determinism-check', COHERENT)
    expect(a).toEqual(b)
  })

  it('a coherent programme scores no lower than a contradictory one, all else equal', () => {
    const coherent = computeElectionResult('same-seed', COHERENT)
    const contradictory = computeElectionResult('same-seed', CONTRADICTORY)
    expect(coherent.scorePct).toBeGreaterThanOrEqual(contradictory.scorePct)
  })
})

describe('derivePoliticalProfileLabel — descriptive only, never ideological', () => {
  it('never returns anything outside the 5 documented labels', () => {
    const labels = new Set(['RÉFORMATEUR', 'INVESTISSEUR', 'PROTECTEUR', 'GESTIONNAIRE', 'PRAGMATIQUE'])
    for (const promises of [COHERENT, CONTRADICTORY]) {
      const result = computeElectionResult('label-check', promises)
      expect(labels.has(result.profileLabel)).toBe(true)
    }
  })
})
