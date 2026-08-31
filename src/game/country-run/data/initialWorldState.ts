import type { WorldState } from '../../../engine/economy/types.ts'

/**
 * ⚠️ PLACEHOLDER WORLD DATASET — NOT REAL DATA. Same caveat as
 * `initialState.ts`: fictional, roughly-plausible starting values for the
 * exogenous world (Product Bible §5), not sourced Eurozone/ECB/energy data.
 * Replace before any real dataset milestone.
 */
export function createInitialWorldState(): WorldState {
  return {
    eurozoneGrowth: 1.2, // %/year, placeholder
    ecbRate: 3.0, // %/year, placeholder
    oilPriceIndex: 100, // index, 100 = baseline at campaign start, placeholder
    globalTradeGrowth: 2.0, // %/year, placeholder
    externalInflation: 1.7, // %/year, placeholder — matches the M1.5 inflation calibration reference
  }
}
