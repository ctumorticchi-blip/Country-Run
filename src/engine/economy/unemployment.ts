import { TURNS_PER_YEAR } from '../state/calendar.ts'
import type { EconomicEngineConfig } from './config/types.ts'

export interface ComputeUnemploymentInput {
  unemploymentPrev: number
  structuralUnemploymentPrev: number
  growth: number
  potentialGrowth: number
  config: EconomicEngineConfig['unemployment']
}

/**
 * cyclicalChange = -okunBeta × (growth - potentialGrowth) / turnsPerYear
 * (Product Bible §12, an Okun's-law-style relation), plus a slow drift back
 * toward `structuralUnemployment` so unemployment doesn't permanently drift
 * away from its structural anchor absent a growth gap.
 *
 * `structuralUnemployment` itself only moves via delayed effects scheduled
 * from `laborMarketReform` (see productivity.ts) — never instantly, and
 * never from this function.
 */
export function computeUnemployment(input: ComputeUnemploymentInput): number {
  const { unemploymentPrev, structuralUnemploymentPrev, growth, potentialGrowth, config } = input

  const cyclicalChange = (-config.okunBeta * (growth - potentialGrowth)) / TURNS_PER_YEAR
  const structuralDrift = (structuralUnemploymentPrev - unemploymentPrev) * config.meanReversionSpeed

  const next = unemploymentPrev + cyclicalChange + structuralDrift
  return Math.min(config.maxUnemployment, Math.max(config.minUnemployment, next))
}
