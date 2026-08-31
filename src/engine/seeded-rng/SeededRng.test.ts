import { describe, expect, it } from 'vitest'
import { SeededRng } from './SeededRng.ts'

describe('SeededRng', () => {
  it('produces the exact same sequence for the same seed', () => {
    const a = new SeededRng('country-run-seed')
    const b = new SeededRng('country-run-seed')

    const sequenceA = Array.from({ length: 20 }, () => a.next())
    const sequenceB = Array.from({ length: 20 }, () => b.next())

    expect(sequenceA).toEqual(sequenceB)
  })

  it('produces a different trajectory for a different seed', () => {
    const a = new SeededRng('seed-one')
    const b = new SeededRng('seed-two')

    const sequenceA = Array.from({ length: 20 }, () => a.next())
    const sequenceB = Array.from({ length: 20 }, () => b.next())

    expect(sequenceA).not.toEqual(sequenceB)
  })

  it('next() stays within [0, 1)', () => {
    const rng = new SeededRng('bounds-check')
    for (let i = 0; i < 500; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('integer() stays within the requested inclusive bounds', () => {
    const rng = new SeededRng('integer-check')
    for (let i = 0; i < 500; i++) {
      const value = rng.integer(3, 7)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(3)
      expect(value).toBeLessThanOrEqual(7)
    }
  })

  it('integer() can produce every value in a small range', () => {
    const rng = new SeededRng('integer-coverage')
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      seen.add(rng.integer(0, 2))
    }
    expect(seen).toEqual(new Set([0, 1, 2]))
  })

  it('integer() rejects an inverted range', () => {
    const rng = new SeededRng('integer-invalid')
    expect(() => rng.integer(5, 1)).toThrow(RangeError)
  })

  it('float() stays within the requested [min, max) bounds', () => {
    const rng = new SeededRng('float-check')
    for (let i = 0; i < 500; i++) {
      const value = rng.float(-2, 2)
      expect(value).toBeGreaterThanOrEqual(-2)
      expect(value).toBeLessThan(2)
    }
  })

  it('chance() approximates the requested probability over many trials', () => {
    const rng = new SeededRng('chance-check')
    const trials = 20_000
    let successes = 0
    for (let i = 0; i < trials; i++) {
      if (rng.chance(0.3)) successes++
    }
    const ratio = successes / trials
    expect(ratio).toBeGreaterThan(0.27)
    expect(ratio).toBeLessThan(0.33)
  })

  it('chance(0) never succeeds and chance(1) always succeeds', () => {
    const rng = new SeededRng('chance-edges')
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false)
    }
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(1)).toBe(true)
    }
  })

  it('pick() only returns elements from the given array', () => {
    const rng = new SeededRng('pick-check')
    const items = ['a', 'b', 'c', 'd'] as const
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items))
    }
  })

  it('pick() throws on an empty array', () => {
    const rng = new SeededRng('pick-empty')
    expect(() => rng.pick([])).toThrow(RangeError)
  })

  it('is deterministic across methods, not just next()', () => {
    const run = (seed: string) => {
      const rng = new SeededRng(seed)
      return [rng.integer(0, 100), rng.float(0, 1), rng.chance(0.5), rng.pick(['x', 'y', 'z'])] as const
    }

    expect(run('replay-seed')).toEqual(run('replay-seed'))
  })
})
