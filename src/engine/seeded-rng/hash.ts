/**
 * FNV-1a 32-bit string hash. Used to turn an arbitrary seed string into the
 * numeric internal state a PRNG algorithm needs.
 */
export function hashStringToInt32(input: string): number {
  let hash = 0x811c9dc5

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}
