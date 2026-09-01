/**
 * Government profile modifiers (M3 §16). Each dimension is a multiplier in
 * [0.90, 1.10] — 1.00 is neutral. These NEVER mutate the generic engine's
 * `DEFAULT_ECONOMIC_ENGINE_CONFIG` globally; `governmentEffects.ts` defines
 * a small set of controlled integration points where a modifier is read and
 * applied to a per-playthrough value (a cloned config, a scaled policy
 * input, a scaled probability) before it reaches the engine or the
 * prototype's own political-state helpers. See governmentEffects.ts's file
 * header for the full list of integration points.
 */
export interface GovernmentModifiers {
  /** Scales the effective magnitude of enacted fiscal/investment policy (governmentEffects.ts: applyExecutionScaling). */
  economicExecution: number
  /** Narrows/widens the displayed uncertainty range on fiscal estimates (governmentEffects.ts: fiscalEstimateRange). */
  fiscalForecastAccuracy: number
  /** Scales the two structural reform fields specifically (governmentEffects.ts: applyExecutionScaling). */
  reformEffectiveness: number
  /** Scales Parliament pass probability (governmentEffects.ts: scaleParliamentPassProbability). */
  parliamentNegotiation: number
  /** Dampens/amplifies negative popularity swings (governmentEffects.ts: applyPopularityResilience). */
  popularityResilience: number
  /** One-time marketConfidence nudge at government selection (governmentEffects.ts: governmentMarketConfidenceNudge). */
  marketCredibility: number
  /** Scales delayed-effect horizons in a per-playthrough engine config clone (governmentEffects.ts: deriveGovernmentEngineConfig). */
  implementationSpeed: number
}

export interface GovernmentProfileDefinition {
  id: string
  name: string
  tagline: string
  description: string
  strengths: string[]
  weaknesses: string[]
  modifiers: GovernmentModifiers
}
