import type { ServiceIndices } from './financeTypes.ts'

/**
 * ⚠️ PROTOTYPE CONTENT (M6 §45-46). `health`/`education`/`security`/
 * `administration` — an INDEX, not a score (100 = the France-2027 starting
 * baseline), drifting GRADUALLY toward a funding-implied target rather than
 * jumping the turn a budget is adopted ("a +10 Md€ education budget should
 * not instantly increase service quality by 10%", M6 §46). The
 * housing/environment/culture index the brief marks OPTIONAL is
 * deliberately not built — `territories` stays a spending block without a
 * dedicated index (documented scope decision, see docs/ECONOMY_BUDGET_M6.md).
 *
 * Every coefficient below is a documented GAMEPLAY CALIBRATION PLACEHOLDER,
 * centralized here exactly once (M6 §46) rather than scattered across
 * content files.
 */
export const SERVICE_INDEX_CONFIG = {
  /** Index points of TARGET shift per Md€/year of funding change from baseline. */
  fundingSensitivity: 0.5,
  /** Index points of TARGET shift per 1.0 of `publicSectorReform` intensity (administration only). */
  reformSensitivity: 8,
  /** Fraction of the remaining gap to the target closed each TURN — small, so a funding change takes several years to fully show up. */
  driftRatePerTurn: 0.05,
  /** Safety clamp — a documented plausibility bound wider than the "typical 5-year range" (85-115) the brief describes, so an extreme deliberate strategy can still be seen moving without ever becoming absurd. */
  min: 60,
  max: 140,
}

function driftOneIndex(previous: number, target: number): number {
  const next = previous + (target - previous) * SERVICE_INDEX_CONFIG.driftRatePerTurn
  return Math.min(SERVICE_INDEX_CONFIG.max, Math.max(SERVICE_INDEX_CONFIG.min, next))
}

export interface ServiceIndexInputs {
  healthFundingDelta: number
  educationFundingDelta: number
  securityFundingDelta: number
  administrationFundingDelta: number
  administrationReformLevel: number
}

/** One turn's gradual drift for every index, given the currently-enacted funding signal per block (M6 §45: "gradual/delayed adjustment"). Pure — the caller stores the result. */
export function driftServiceIndices(previous: ServiceIndices, inputs: ServiceIndexInputs): ServiceIndices {
  const { fundingSensitivity, reformSensitivity } = SERVICE_INDEX_CONFIG
  return {
    health: driftOneIndex(previous.health, 100 + inputs.healthFundingDelta * fundingSensitivity),
    education: driftOneIndex(previous.education, 100 + inputs.educationFundingDelta * fundingSensitivity),
    security: driftOneIndex(previous.security, 100 + inputs.securityFundingDelta * fundingSensitivity),
    administration: driftOneIndex(
      previous.administration,
      100 + inputs.administrationFundingDelta * fundingSensitivity + inputs.administrationReformLevel * reformSensitivity,
    ),
  }
}

/** A composite, funding-weighted read used only by the `restore-public-services` promise evaluator (M6 §50) — never shown to the player as a raw number by itself. */
export function compositeServiceIndex(indices: ServiceIndices): number {
  return (indices.health + indices.education + indices.security + indices.administration) / 4
}
