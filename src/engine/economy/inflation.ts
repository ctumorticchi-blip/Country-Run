import type { SeededRng } from '../seeded-rng/SeededRng.ts'
import type { EconomicEngineConfig } from './config/types.ts'
import { controlledNoise } from './noise.ts'
import type { EconomicDiagnostics, WorldState } from './types.ts'

export interface ComputeInflationInput {
  inflationPrev: number
  growth: number
  potentialGrowth: number
  gdp: number
  world: WorldState
  /** householdTaxImpulse + businessTaxImpulse, Md€/year (temporary pass-through of tax changes into prices). */
  taxImpulse: number
  rng: SeededRng
  config: EconomicEngineConfig['inflation']
}

/**
 * inflation = externalInflation + demandPressure + energyShock + temporaryTaxEffects,
 * blended with inertia from the previous turn's inflation (Product Bible
 * §6, §13 — "L'inflation doit posséder de l'inertie. Évite les variations
 * absurdes d'un tour au suivant.").
 */
export function computeInflation(
  input: ComputeInflationInput,
): { inflation: number; contributions: EconomicDiagnostics['inflationContributions'] } {
  const { inflationPrev, growth, potentialGrowth, gdp, world, taxImpulse, config } = input

  const demandPressure = (growth - potentialGrowth) * config.demandPressureCoefficient
  const external = world.externalInflation * config.externalPassthrough
  const energy = ((world.oilPriceIndex - 100) / 100) * config.energyPassthrough
  const tax = (taxImpulse / gdp) * 100 * config.taxPassthrough
  const noise = controlledNoise(input.rng, config.noiseStdDev)

  const rawTarget = external + demandPressure + energy + tax

  const inertiaContribution = inflationPrev * config.inertia
  const freshContribution = rawTarget * (1 - config.inertia)

  const inflation = Math.min(config.maxInflation, Math.max(config.minInflation, inertiaContribution + freshContribution + noise))

  const contributions: EconomicDiagnostics['inflationContributions'] = {
    inertia: inertiaContribution,
    demandPressure: demandPressure * (1 - config.inertia),
    external: external * (1 - config.inertia),
    energy: energy * (1 - config.inertia),
    tax: tax * (1 - config.inertia),
    noise,
  }

  return { inflation, contributions }
}
