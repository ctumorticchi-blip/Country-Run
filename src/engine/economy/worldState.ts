import type { ExternalShock, WorldState } from './types.ts'

/**
 * Applies one ExternalShock's world deltas to a WorldState, returning a new
 * WorldState. Only `oilPriceIndex` is floored at 0 (a physical necessity);
 * the other exogenous rates are left unclamped — an extreme shock producing
 * an extreme world reading is the point.
 */
export function applyExternalShockToWorld(world: WorldState, shock: ExternalShock): WorldState {
  if (!shock.world) return world

  return {
    ...world,
    eurozoneGrowth: world.eurozoneGrowth + (shock.world.eurozoneGrowth ?? 0),
    oilPriceIndex: Math.max(0, world.oilPriceIndex + (shock.world.oilPriceIndex ?? 0)),
    globalTradeGrowth: world.globalTradeGrowth + (shock.world.globalTradeGrowth ?? 0),
    externalInflation: world.externalInflation + (shock.world.externalInflation ?? 0),
  }
}

/** Folds a sequence of shocks onto a WorldState, in order. */
export function applyExternalShocksToWorld(world: WorldState, shocks: readonly ExternalShock[]): WorldState {
  return shocks.reduce(applyExternalShockToWorld, world)
}
