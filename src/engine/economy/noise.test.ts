import { describe, expect, it } from 'vitest'
import { SeededRng } from '../seeded-rng/SeededRng.ts'
import { controlledNoise } from './noise.ts'

describe('controlledNoise', () => {
  it('returns 0 when stdDev is 0 (or negative)', () => {
    const rng = new SeededRng('noise-zero')
    expect(controlledNoise(rng, 0)).toBe(0)
    expect(controlledNoise(rng, -1)).toBe(0)
  })

  it('always stays within [-stdDev, stdDev]', () => {
    const rng = new SeededRng('noise-bounds')
    for (let i = 0; i < 1000; i++) {
      const value = controlledNoise(rng, 0.4)
      expect(value).toBeGreaterThanOrEqual(-0.4)
      expect(value).toBeLessThanOrEqual(0.4)
    }
  })

  it('is deterministic for a given seed and call sequence', () => {
    const run = (seed: string) => {
      const rng = new SeededRng(seed)
      return Array.from({ length: 10 }, () => controlledNoise(rng, 1))
    }
    expect(run('replay-seed')).toEqual(run('replay-seed'))
  })

  it('never calls Math.random (uses only the seeded RNG)', () => {
    const originalRandom = Math.random
    let called = false
    Math.random = () => {
      called = true
      return originalRandom()
    }
    try {
      const rng = new SeededRng('purity-check')
      controlledNoise(rng, 0.5)
      expect(called).toBe(false)
    } finally {
      Math.random = originalRandom
    }
  })

  it('is not systematically biased away from 0 over many draws', () => {
    const rng = new SeededRng('noise-mean')
    const samples = Array.from({ length: 5000 }, () => controlledNoise(rng, 1))
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
    expect(Math.abs(mean)).toBeLessThan(0.05)
  })
})
