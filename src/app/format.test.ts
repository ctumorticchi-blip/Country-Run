import { describe, expect, it } from 'vitest'
import { formatRange } from './format.ts'

describe('formatRange (M6.2 §11 — collapse identical forecast ranges)', () => {
  it('collapses to a single value when both formatted endpoints are identical', () => {
    expect(formatRange('7,9 %', '7,9 %')).toBe('7,9 %')
    expect(formatRange('102 Md€', '102 Md€')).toBe('102 Md€')
  })

  it('keeps a real range when the formatted endpoints differ', () => {
    expect(formatRange('5,4', '6,0')).toBe('5,4–6,0')
  })

  it('collapses ranges that only differ before rounding but are equal once formatted', () => {
    // e.g. low=7.94, high=7.941 both round to "7.9" at 1 decimal — must not show a fake range.
    expect(formatRange((7.94).toFixed(1), (7.941).toFixed(1))).toBe('7.9')
  })

  it('supports a custom dash/separator', () => {
    expect(formatRange('1', '2', ' à ')).toBe('1 à 2')
    expect(formatRange('1', '1', ' à ')).toBe('1')
  })
})
