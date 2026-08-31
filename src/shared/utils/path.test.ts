import { describe, expect, it } from 'vitest'
import { getValueAtPath, setValueAtPath } from './path.ts'

describe('getValueAtPath', () => {
  it('reads a nested value', () => {
    const obj = { economic: { gdp: 2800 } }
    expect(getValueAtPath(obj, 'economic.gdp')).toBe(2800)
  })

  it('reads a top-level value', () => {
    const obj = { turn: 3 }
    expect(getValueAtPath(obj, 'turn')).toBe(3)
  })

  it('returns undefined for a missing path', () => {
    const obj = { economic: { gdp: 2800 } }
    expect(getValueAtPath(obj, 'economic.unknown')).toBeUndefined()
    expect(getValueAtPath(obj, 'political.popularity')).toBeUndefined()
  })
})

describe('setValueAtPath', () => {
  it('sets a nested value without mutating the source', () => {
    const obj = { economic: { gdp: 2800, growth: 1.1 } }
    const next = setValueAtPath(obj, 'economic.gdp', 3000)

    expect(next.economic.gdp).toBe(3000)
    expect(next.economic.growth).toBe(1.1)
    expect(obj.economic.gdp).toBe(2800)
    expect(obj).not.toBe(next)
    expect(obj.economic).not.toBe(next.economic)
  })

  it('sets a top-level value', () => {
    const obj = { turn: 3 }
    const next = setValueAtPath(obj, 'turn', 4)
    expect(next.turn).toBe(4)
    expect(obj.turn).toBe(3)
  })

  it('leaves sibling branches referentially unchanged (structural sharing)', () => {
    const obj = { economic: { gdp: 2800 }, political: { popularity: 45 } }
    const next = setValueAtPath(obj, 'economic.gdp', 3000)
    expect(next.political).toBe(obj.political)
  })
})
