import type { SeededRng } from '../seeded-rng/SeededRng.ts'

/**
 * Controlled, bounded, deterministic noise for the economic engine.
 *
 * Sums three independent `[-1, 1)` draws from the SeededRng and scales the
 * result — an Irwin-Hall-style approximation that concentrates mass near 0
 * (a rough, cheap stand-in for a bell curve) without needing trigonometric
 * transforms. The result is always within `[-stdDev, stdDev]`, so a small
 * `stdDev` can never itself produce an implausible swing — see
 * docs/ECONOMIC_ENGINE.md ("Incertitude").
 *
 * Never uses `Math.random()` — only the seeded RNG, so the same seed and
 * the same sequence of calls always produce the same noise.
 */
export function controlledNoise(rng: SeededRng, stdDev: number): number {
  if (stdDev <= 0) return 0
  const sum = rng.float(-1, 1) + rng.float(-1, 1) + rng.float(-1, 1)
  return (sum / 3) * stdDev
}
