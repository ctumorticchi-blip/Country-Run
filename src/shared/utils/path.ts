import type { StatePath } from '../types/path.ts'

/**
 * Reads the value at `path` (e.g. "economic.gdp") inside `source`.
 * Returns `undefined` if any segment along the way is missing.
 */
export function getValueAtPath(source: unknown, path: StatePath): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, source)
}

/**
 * Returns a new object with the value at `path` replaced by `value`, without
 * mutating `source`. Every object along the path is shallow-copied; siblings
 * are left untouched (structural sharing).
 */
export function setValueAtPath<T extends object>(source: T, path: StatePath, value: unknown): T {
  const [head, ...rest] = path.split('.')

  if (rest.length === 0) {
    return { ...source, [head]: value }
  }

  const record = source as unknown as Record<string, unknown>
  const child = record[head]
  const nextChild = setValueAtPath(
    typeof child === 'object' && child !== null ? child : {},
    rest.join('.'),
    value,
  )

  return { ...source, [head]: nextChild }
}
