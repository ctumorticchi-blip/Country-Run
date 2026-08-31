import { hashStringToInt32 } from './hash.ts'

/**
 * A deterministic pseudo-random number generator: the same seed always
 * produces the same sequence of outputs, and different seeds produce
 * different trajectories. This is what makes Daily Run / Challenge seeds and
 * replay possible.
 *
 * Algorithm: mulberry32, seeded from an FNV-1a hash of the seed string.
 * It is not cryptographically secure and is not meant to be — it only needs
 * to be fast, deterministic, and statistically reasonable for gameplay.
 */
export class SeededRng {
  private state: number

  constructor(seed: string) {
    // Avoid a zero internal state, which would make mulberry32 degenerate.
    this.state = hashStringToInt32(seed) || 1
  }

  /** Returns the next pseudo-random float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Returns a pseudo-random integer in [min, max], inclusive on both ends. */
  integer(min: number, max: number): number {
    if (max < min) throw new RangeError(`integer(): max (${String(max)}) must be >= min (${String(min)})`)
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /** Returns a pseudo-random float in [min, max). */
  float(min: number, max: number): number {
    if (max < min) throw new RangeError(`float(): max (${String(max)}) must be >= min (${String(min)})`)
    return this.next() * (max - min) + min
  }

  /** Returns true with the given probability (0 = never, 1 = always). */
  chance(probability: number): boolean {
    return this.next() < probability
  }

  /** Returns a pseudo-randomly picked element from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick(): cannot pick from an empty array')
    return items[this.integer(0, items.length - 1)]
  }
}
