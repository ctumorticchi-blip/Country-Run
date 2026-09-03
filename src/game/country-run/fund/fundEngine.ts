import { createActionRng } from '../prototype/rng.ts'
import { NO_SOVEREIGN_FUND, type SovereignFundFundingSource, type SovereignFundGovernance, type SovereignFundHolding, type SovereignFundState, type SovereignFundStrategy } from './fundTypes.ts'

/**
 * M6.5 §37: static per-strategy return distribution parameters — a
 * documented, gameplay-tuned annual return range, NOT a sourced financial
 * model. `meanReturn`/`spread` describe a bounded, seeded-uniform draw
 * (see `computeAnnualReturn`) — losses are always possible (every
 * strategy's low end is negative), strong gains are always possible, and
 * `spread` stays well short of "casino-level volatility" (M6.5 §38).
 */
interface StrategyProfile {
  meanReturn: number
  spread: number
  holdings: SovereignFundHolding[]
}

const STRATEGY_PROFILES: Record<SovereignFundStrategy, StrategyProfile> = {
  PRUDENT: {
    meanReturn: 0.03,
    spread: 0.04,
    holdings: [
      { category: 'Infrastructures', share: 0.5 },
      { category: 'Obligations souveraines européennes', share: 0.35 },
      { category: 'Actifs stratégiques', share: 0.15 },
    ],
  },
  INDUSTRIAL: {
    meanReturn: 0.05,
    spread: 0.09,
    holdings: [
      { category: 'Énergie', share: 0.4 },
      { category: 'Industrie', share: 0.35 },
      { category: 'Défense', share: 0.25 },
    ],
  },
  INNOVATION: {
    meanReturn: 0.07,
    spread: 0.16,
    holdings: [
      { category: 'Intelligence artificielle', share: 0.4 },
      { category: 'Biotechnologies', share: 0.3 },
      { category: 'Robotique / deeptech', share: 0.3 },
    ],
  },
  DIVERSIFIED: {
    meanReturn: 0.045,
    spread: 0.07,
    holdings: [
      { category: 'France / Europe', share: 0.5 },
      { category: 'International', share: 0.35 },
      { category: 'Liquidités', share: 0.15 },
    ],
  },
}

export const SOVEREIGN_FUND_CAPITALIZATION_TIERS = [20, 30, 50] as const

/**
 * M6.5 §34-35: EACH funding source has a genuinely different consequence —
 * "do not create free money". DEBT is the only source that moves the debt
 * stock (a one-off, since capitalizing a fund is an ASSET SWAP, not
 * ordinary consumption — the operating deficit/fiscalBalance never moves,
 * only the debt stock itself, applied once at creation via the same
 * generic `engine/effects` mechanism `nudgePolitical` already uses for a
 * one-off popularity nudge). ASSET_SALES and BUDGET_REALLOCATION touch
 * neither debt nor deficit (a real asset-for-asset swap / cash already
 * held redirected) but carry their own political cost. HYBRID splits the
 * debt exposure in half. This function is PURE — the caller applies the
 * returned deltas via the existing, already-tested `applyEffect`/
 * `nudgePolitical` machinery; nothing here mutates state directly.
 */
export interface FundCreationConsequence {
  debtDelta: number
  popularityDelta: number
  description: string
}

export function fundCreationConsequence(capitalization: number, source: SovereignFundFundingSource): FundCreationConsequence {
  switch (source) {
    case 'DEBT':
      return {
        debtDelta: capitalization,
        popularityDelta: -1,
        description: `Le fonds est capitalisé par émission de dette (+${String(capitalization)} Md€ de dette, sans effet sur le déficit — un échange d’actifs, pas une dépense).`,
      }
    case 'ASSET_SALES':
      return {
        debtDelta: 0,
        popularityDelta: -3,
        description: `Le fonds est capitalisé par cession d’actifs publics (${String(capitalization)} Md€) — sans effet sur la dette, mais politiquement sensible.`,
      }
    case 'BUDGET_REALLOCATION':
      return {
        debtDelta: 0,
        popularityDelta: -2,
        description: `Le fonds est capitalisé par réallocation budgétaire (${String(capitalization)} Md€) — sans effet sur la dette, au prix d’un arbitrage budgétaire ailleurs.`,
      }
    case 'HYBRID':
      return {
        debtDelta: capitalization / 2,
        popularityDelta: -2,
        description: `Le fonds est capitalisé pour moitié par dette, pour moitié par réallocation/cession (${String(capitalization)} Md€ au total).`,
      }
  }
}

export function createSovereignFund(
  capitalization: number,
  fundingSource: SovereignFundFundingSource,
  strategy: SovereignFundStrategy,
  governance: SovereignFundGovernance,
  turn: number,
): SovereignFundState {
  return {
    ...NO_SOVEREIGN_FUND,
    exists: true,
    createdTurn: turn,
    capitalContributed: capitalization,
    portfolioValue: capitalization,
    strategy,
    governance,
    fundingSource,
    cumulativeReturn: 0,
    cumulativeDividendsToState: 0,
    holdings: STRATEGY_PROFILES[strategy].holdings,
    lastRecapitalizationTurn: null,
  }
}

/**
 * M6.5 §38: one YEAR's return (not per-turn — a fund doesn't need
 * turn-by-turn noise) — deterministic, seeded (never `Math.random`), a
 * bounded uniform draw around the strategy's `meanReturn`. `year` (not
 * `turn`) keys the RNG label so replaying the same seed always yields the
 * same return sequence regardless of how/when the fund was queried.
 */
export function computeAnnualReturn(strategy: SovereignFundStrategy, seed: string, year: number): number {
  const profile = STRATEGY_PROFILES[strategy]
  const rng = createActionRng(seed, `sovereign-fund-return-year-${String(year)}`)
  return rng.float(profile.meanReturn - profile.spread, profile.meanReturn + profile.spread)
}

export interface ApplyAnnualReturnResult {
  fund: SovereignFundState
  returnRate: number
  returnAmount: number
}

/** Applies one year's deterministic return to the portfolio — pure, returns a new `SovereignFundState`. */
export function applyAnnualReturn(fund: SovereignFundState, seed: string, year: number): ApplyAnnualReturnResult {
  const returnRate = computeAnnualReturn(fund.strategy, seed, year)
  const returnAmount = fund.portfolioValue * returnRate
  return {
    fund: { ...fund, portfolioValue: Math.max(0, fund.portfolioValue + returnAmount), cumulativeReturn: fund.cumulativeReturn + returnAmount },
    returnRate,
    returnAmount,
  }
}

/**
 * M6.5 §42: REINVEST raises future fund capital (stays in the portfolio);
 * TRANSFER moves it to the state as public revenue — the ORIGINAL
 * `capitalContributed` can never be withdrawn as "revenue" this way,
 * only genuine investment RETURNS (bounded to the fund's current
 * `cumulativeReturn` still sitting in the portfolio, so a loss-making
 * fund has nothing transferable).
 */
export function maxTransferableDividend(fund: SovereignFundState): number {
  return Math.max(0, Math.min(fund.cumulativeReturn, fund.portfolioValue - fund.capitalContributed))
}

export interface TransferDividendResult {
  fund: SovereignFundState
  transferredAmount: number
}

export function transferDividendToState(fund: SovereignFundState, amount: number): TransferDividendResult {
  const transferredAmount = Math.max(0, Math.min(amount, maxTransferableDividend(fund)))
  return {
    fund: { ...fund, portfolioValue: fund.portfolioValue - transferredAmount, cumulativeDividendsToState: fund.cumulativeDividendsToState + transferredAmount },
    transferredAmount,
  }
}

export const RECAPITALIZATION_COOLDOWN_TURNS = 12

export function canRecapitalize(fund: SovereignFundState, turn: number): boolean {
  if (!fund.exists) return false
  if (fund.lastRecapitalizationTurn === null) return true
  return turn - fund.lastRecapitalizationTurn >= RECAPITALIZATION_COOLDOWN_TURNS
}

export function recapitalize(fund: SovereignFundState, amount: number, turn: number): SovereignFundState {
  return {
    ...fund,
    capitalContributed: fund.capitalContributed + amount,
    portfolioValue: fund.portfolioValue + amount,
    lastRecapitalizationTurn: turn,
  }
}

/** M6.5 §46: the final mandate-review figure — net value created (or destroyed) since creation, dividends included. */
export function netValueCreated(fund: SovereignFundState): number {
  return fund.portfolioValue + fund.cumulativeDividendsToState - fund.capitalContributed
}

/**
 * M6.5 §40/45: a fund-portfolio choice (strategic-stake acquisition,
 * industrial opportunity, European co-investment) reallocates EXISTING
 * portfolio value into a new named holding — never new capital, so
 * `portfolioValue`/`capitalContributed` are untouched (this is what keeps
 * these choices out of the fiscal ledger entirely — see the
 * `fund-acquires-stake` choice's own doc comment in eventCatalog.ts).
 * Every other holding is rescaled proportionally so shares still sum to 1.
 */
export function acquireStake(fund: SovereignFundState, category: string, share = 0.06): SovereignFundState {
  const clampedShare = Math.max(0, Math.min(0.3, share))
  const scale = 1 - clampedShare
  const rescaled = fund.holdings.map((h) => ({ category: h.category, share: h.share * scale }))
  const existingIndex = rescaled.findIndex((h) => h.category === category)
  const holdings =
    existingIndex >= 0
      ? rescaled.map((h, i) => (i === existingIndex ? { ...h, share: h.share + clampedShare } : h))
      : [...rescaled, { category, share: clampedShare }]
  return { ...fund, holdings }
}
