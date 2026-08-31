/**
 * Every coefficient the Economic Engine's formulas use. See
 * `defaultConfig.ts` for the actual values and their calibration status —
 * this file only defines the shape, so the formulas (`growth.ts`,
 * `inflation.ts`, etc.) never have a bare numeric literal buried inline
 * (Product Bible §16, "Tout coefficient économique important doit être
 * configurable, pas enfoui dans l'UI").
 */
export interface EconomicEngineConfig {
  growth: {
    /** Md€ of demand-side impulse to annualized-growth-pp-per-GDP effect, by fiscal category. */
    fiscalMultiplier: {
      currentSpending: number
      publicInvestment: number
      transfers: number
      businessTax: number
      householdTax: number
    }
    externalEurozoneWeight: number
    externalTradeWeight: number
    /** Weight applied to (average consumer/business confidence - 50) / 50 * 10. */
    confidenceWeight: number
    /** Share of productivityGrowth that passes through directly into headline growth. */
    productivityPassthrough: number
    /** Annualized pp std-dev of controlled growth noise. */
    noiseStdDev: number
  }
  potentialGrowth: {
    /** Fixed annualized pp baseline contribution from labor. */
    laborContribution: number
    productivityPassthrough: number
  }
  unemployment: {
    /** Okun's-law-style sensitivity: cyclicalChange = -okunBeta * (growth - potentialGrowth) / turnsPerYear. */
    okunBeta: number
    /** Fraction of the gap to structuralUnemployment closed per turn (pure drift, not reform). */
    meanReversionSpeed: number
    structuralReformDelayTurns: number
    /** Max structuralUnemployment pp reduction at reform intensity = 1. */
    structuralReformEffectPerIntensity: number
    minUnemployment: number
    maxUnemployment: number
  }
  inflation: {
    /** Weight kept from the previous turn's inflation, in [0, 1]. */
    inertia: number
    demandPressureCoefficient: number
    externalPassthrough: number
    /** Coefficient on (oilPriceIndex - 100) / 100. */
    energyPassthrough: number
    /** Coefficient on (householdTaxImpulse + businessTaxImpulse) / gdp * 100. */
    taxPassthrough: number
    noiseStdDev: number
    minInflation: number
    maxInflation: number
  }
  revenue: {
    /** revenueGrowth ≈ nominalGrowth × elasticity. */
    elasticity: number
    /** Fraction of publicRevenue used as the std-dev of the controlled revenue surprise. */
    noiseStdDev: number
  }
  spending: {
    /** Annualized pp baseline drift of primary (non-interest) spending absent policy changes. */
    baselineDrift: number
  }
  debt: {
    /** Fraction of the debt stock repriced to the new borrowing rate per turn. */
    refinancingShare: number
    /** pp spread over the ECB rate for a baseline (confidence = 50) sovereign borrowing cost. */
    baselineSpread: number
    /** Additional pp of spread per point of marketConfidence below 50. */
    riskPremiumPerConfidencePoint: number
    /** Md€/year, additional debt-stock adjustment not explained by the fiscal balance. Usually 0. */
    stockFlowAdjustment: number
    minEffectiveDebtRate: number
  }
  purchasingPower: {
    /** Coefficient on transfersChanges / gdp * 100. */
    transfersElasticity: number
    /** Coefficient on householdTaxImpulse / gdp * 100. */
    householdTaxElasticity: number
  }
  confidence: {
    consumer: {
      employmentWeight: number
      purchasingPowerWeight: number
      inflationWeight: number
      stabilityWeight: number
      meanReversion: number
    }
    business: {
      growthWeight: number
      taxWeight: number
      financingCostWeight: number
      stabilityWeight: number
      demandWeight: number
      meanReversion: number
    }
    market: {
      debtRatioWeight: number
      deficitRatioWeight: number
      growthWeight: number
      trajectoryWeight: number
      meanReversion: number
    }
  }
  productivity: {
    infrastructureDelayTurns: number
    /** Annualized productivityGrowth pp added per Md€ of infrastructureInvestment. */
    infrastructureEffectPerBillion: number
    researchDelayTurns: number
    researchEffectPerBillion: number
    /** Std-dev fraction applied (via controlledNoise) to the R&D payoff magnitude. */
    researchUncertainty: number
    educationDelayTurns: number
    educationEffectPerBillion: number
    publicSectorReformDelayTurns: number
    /** Max publicSectorEfficiency points added at reform intensity = 1. */
    publicSectorReformEfficiencyEffectPerIntensity: number
    /** Tiny per-turn drift applied to productivityGrowth regardless of policy. */
    baseDriftPerTurn: number
  }
  bounds: {
    minGdp: number
    minDebt: number
  }
}
