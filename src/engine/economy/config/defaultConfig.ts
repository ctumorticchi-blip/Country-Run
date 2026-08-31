import type { EconomicEngineConfig } from './types.ts'

/**
 * ⚠️ GAMEPLAY PARAMETERS — NOT ECONOMETRIC ESTIMATES.
 *
 * Every number below is a starting coefficient for Country Run's gameplay
 * model, picked to produce plausible-*feeling*, internally consistent
 * trajectories. None of them are derived from empirical estimation of the
 * real French economy, and none should ever be presented to a player (or
 * anyone else) as a validated economic finding.
 *
 * Calibration Status: PLACEHOLDER / CALIBRATION NEEDED for every field in
 * this file (see docs/ECONOMIC_ENGINE.md, "Calibration Status"). Tuning
 * these to feel right across many playthroughs — not to match real-world
 * data — is explicitly a later milestone.
 */
export const DEFAULT_ECONOMIC_ENGINE_CONFIG: EconomicEngineConfig = {
  growth: {
    fiscalMultiplier: {
      currentSpending: 0.5,
      publicInvestment: 0.7,
      transfers: 0.6,
      businessTax: 0.3,
      householdTax: 0.5,
    },
    externalEurozoneWeight: 0.15,
    externalTradeWeight: 0.05,
    confidenceWeight: 0.4,
    productivityPassthrough: 0.15,
    noiseStdDev: 0.3,
  },
  potentialGrowth: {
    laborContribution: 0.4,
    productivityPassthrough: 0.6,
  },
  unemployment: {
    okunBeta: 0.5,
    meanReversionSpeed: 0.05,
    structuralReformDelayTurns: 6,
    structuralReformEffectPerIntensity: 1.5,
    minUnemployment: 2,
    maxUnemployment: 20,
  },
  inflation: {
    inertia: 0.6,
    demandPressureCoefficient: 0.3,
    externalPassthrough: 1.0,
    energyPassthrough: 0.15,
    taxPassthrough: 0.1,
    noiseStdDev: 0.25,
    minInflation: -3,
    maxInflation: 15,
  },
  revenue: {
    elasticity: 0.9,
    noiseStdDev: 0.01,
  },
  spending: {
    baselineDrift: 2.6,
  },
  debt: {
    refinancingShare: 0.08,
    baselineSpread: 0.5,
    riskPremiumPerConfidencePoint: 0.015,
    stockFlowAdjustment: 0,
    minEffectiveDebtRate: 0.1,
  },
  purchasingPower: {
    transfersElasticity: 0.5,
    householdTaxElasticity: 0.6,
  },
  confidence: {
    consumer: {
      employmentWeight: 3,
      purchasingPowerWeight: 2,
      inflationWeight: 2,
      stabilityWeight: 0.3,
      meanReversion: 0.15,
    },
    business: {
      growthWeight: 4,
      taxWeight: 2,
      financingCostWeight: 3,
      stabilityWeight: 0.3,
      demandWeight: 0.2,
      meanReversion: 0.15,
    },
    market: {
      debtRatioWeight: 0.3,
      deficitRatioWeight: 2,
      growthWeight: 1,
      trajectoryWeight: 1.5,
      meanReversion: 0.12,
    },
  },
  productivity: {
    infrastructureDelayTurns: 9,
    infrastructureEffectPerBillion: 0.006,
    researchDelayTurns: 15,
    researchEffectPerBillion: 0.008,
    researchUncertainty: 0.5,
    educationDelayTurns: 30,
    educationEffectPerBillion: 0.003,
    publicSectorReformDelayTurns: 6,
    publicSectorReformEfficiencyEffectPerIntensity: 8,
    baseDriftPerTurn: 0,
  },
  bounds: {
    minGdp: 100,
    minDebt: 0,
  },
}
