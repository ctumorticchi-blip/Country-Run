import type { EconomicState } from '../../../engine/state/gameState.ts'

/**
 * M6 §35-37: primary balance ("solde avant paiement des intérêts de la
 * dette") and an APPROXIMATE debt-stabilization indicator, both read
 * straight off the real simulated `EconomicState` — no second hidden
 * economy, no invented forecast (M6 §37 is explicit about that). The
 * stabilization gap uses the standard debt-dynamics identity already
 * implicit in `engine/economy/debt.ts`'s own calibration
 * (Δdebt ratio ≈ deficit ratio − nominalGrowth × debtRatio / (100 +
 * nominalGrowth)) — kept deliberately approximate per the brief.
 */
export interface PrimaryBalance {
  /** Md€/year — fiscal balance EXCLUDING debt interest; positive = primary surplus. */
  primaryBalanceBn: number
  primaryBalanceRatio: number
}

export function computePrimaryBalance(economic: EconomicState): PrimaryBalance {
  const primaryBalanceBn = economic.fiscalBalance + economic.interestCost
  return { primaryBalanceBn, primaryBalanceRatio: (primaryBalanceBn / economic.nominalGdp) * 100 }
}

export interface DebtStabilization {
  currentDeficitRatio: number
  /** The deficit ratio that would leave `debtRatio` unchanged next year, given the current nominal growth rate. */
  stabilizingDeficitRatio: number
  /** currentDeficitRatio - stabilizingDeficitRatio — positive = debt ratio still rising even at this deficit. */
  gap: number
}

export function computeDebtStabilization(economic: EconomicState): DebtStabilization {
  const nominalGrowth = economic.growth + economic.inflation
  const stabilizingDeficitRatio = (nominalGrowth / (100 + nominalGrowth)) * economic.debtRatio
  return {
    currentDeficitRatio: economic.deficitRatio,
    stabilizingDeficitRatio,
    gap: economic.deficitRatio - stabilizingDeficitRatio,
  }
}
