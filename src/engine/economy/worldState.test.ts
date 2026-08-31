import { describe, expect, it } from 'vitest'
import type { WorldState } from './types.ts'
import { applyExternalShockToWorld, applyExternalShocksToWorld } from './worldState.ts'

function makeWorld(overrides?: Partial<WorldState>): WorldState {
  return {
    eurozoneGrowth: 1.2,
    ecbRate: 3.0,
    oilPriceIndex: 100,
    globalTradeGrowth: 2.0,
    externalInflation: 2.0,
    ...overrides,
  }
}

describe('applyExternalShockToWorld', () => {
  it('is a no-op when the shock has no world deltas', () => {
    const world = makeWorld()
    const next = applyExternalShockToWorld(world, { id: 'no-op' })
    expect(next).toEqual(world)
  })

  it('applies additive deltas to the given fields only', () => {
    const world = makeWorld()
    const next = applyExternalShockToWorld(world, {
      id: 'energy-shock',
      world: { oilPriceIndex: 30, externalInflation: 0.8 },
    })
    expect(next.oilPriceIndex).toBe(130)
    expect(next.externalInflation).toBeCloseTo(2.8)
    expect(next.eurozoneGrowth).toBe(world.eurozoneGrowth)
    expect(next.globalTradeGrowth).toBe(world.globalTradeGrowth)
  })

  it('floors oilPriceIndex at 0', () => {
    const world = makeWorld({ oilPriceIndex: 10 })
    const next = applyExternalShockToWorld(world, { id: 'crash', world: { oilPriceIndex: -50 } })
    expect(next.oilPriceIndex).toBe(0)
  })

  it('never mutates the input world', () => {
    const world = makeWorld()
    const snapshot = { ...world }
    applyExternalShockToWorld(world, { id: 'shock', world: { oilPriceIndex: 20 } })
    expect(world).toEqual(snapshot)
  })
})

describe('applyExternalShocksToWorld', () => {
  it('folds multiple shocks in order', () => {
    const world = makeWorld()
    const next = applyExternalShocksToWorld(world, [
      { id: 'a', world: { oilPriceIndex: 10 } },
      { id: 'b', world: { oilPriceIndex: 5, eurozoneGrowth: -0.3 } },
    ])
    expect(next.oilPriceIndex).toBe(115)
    expect(next.eurozoneGrowth).toBeCloseTo(0.9)
  })

  it('returns the same world when there are no shocks', () => {
    const world = makeWorld()
    expect(applyExternalShocksToWorld(world, [])).toEqual(world)
  })
})
