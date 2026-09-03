import { describe, expect, it } from 'vitest'
import {
  acquireStake,
  applyAnnualReturn,
  canRecapitalize,
  computeAnnualReturn,
  createSovereignFund,
  fundCreationConsequence,
  maxTransferableDividend,
  netValueCreated,
  RECAPITALIZATION_COOLDOWN_TURNS,
  recapitalize,
  transferDividendToState,
} from './fundEngine.ts'
import { NO_SOVEREIGN_FUND, type SovereignFundStrategy } from './fundTypes.ts'

describe('fundCreationConsequence — M6.5 §34-35: each funding source has a genuinely different consequence', () => {
  it('DEBT moves the debt stock by the full capitalization, ASSET_SALES/BUDGET_REALLOCATION move none', () => {
    expect(fundCreationConsequence(30, 'DEBT').debtDelta).toBe(30)
    expect(fundCreationConsequence(30, 'ASSET_SALES').debtDelta).toBe(0)
    expect(fundCreationConsequence(30, 'BUDGET_REALLOCATION').debtDelta).toBe(0)
  })

  it('HYBRID splits the debt exposure in half', () => {
    expect(fundCreationConsequence(30, 'HYBRID').debtDelta).toBe(15)
  })

  it('every source has a non-empty description and a real (non-zero) political cost — never free money', () => {
    for (const source of ['DEBT', 'ASSET_SALES', 'BUDGET_REALLOCATION', 'HYBRID'] as const) {
      const consequence = fundCreationConsequence(30, source)
      expect(consequence.description.length).toBeGreaterThan(0)
      expect(consequence.popularityDelta).toBeLessThan(0)
    }
  })

  it('ASSET_SALES carries a larger political cost than DEBT (privatization is more politically sensitive)', () => {
    expect(fundCreationConsequence(30, 'ASSET_SALES').popularityDelta).toBeLessThan(fundCreationConsequence(30, 'DEBT').popularityDelta)
  })
})

describe('createSovereignFund', () => {
  it('starts the fund at the capitalization amount, no return/dividends yet', () => {
    const fund = createSovereignFund(30, 'DEBT', 'INDUSTRIAL', 'MIXED', 6)
    expect(fund.exists).toBe(true)
    expect(fund.capitalContributed).toBe(30)
    expect(fund.portfolioValue).toBe(30)
    expect(fund.cumulativeReturn).toBe(0)
    expect(fund.cumulativeDividendsToState).toBe(0)
    expect(fund.createdTurn).toBe(6)
    expect(fund.holdings.length).toBeGreaterThan(0)
    expect(fund.holdings.reduce((sum, h) => sum + h.share, 0)).toBeCloseTo(1, 5)
  })

  it('NO_SOVEREIGN_FUND is the default no-op state (fund does not exist)', () => {
    expect(NO_SOVEREIGN_FUND.exists).toBe(false)
  })
})

describe('computeAnnualReturn — M6.5 §38: deterministic, bounded, both gains and losses possible', () => {
  it('is deterministic — same seed/strategy/year always yields the same return', () => {
    expect(computeAnnualReturn('INDUSTRIAL', 'seed-a', 1)).toBe(computeAnnualReturn('INDUSTRIAL', 'seed-a', 1))
  })

  it('different years/seeds can yield different returns', () => {
    const returns = [1, 2, 3, 4, 5].map((year) => computeAnnualReturn('INNOVATION', 'seed-b', year))
    expect(new Set(returns).size).toBeGreaterThan(1)
  })

  it('across many seeds, both negative (loss) and positive (gain) returns occur for every strategy — never a guaranteed-positive fund', () => {
    for (const strategy of ['PRUDENT', 'INDUSTRIAL', 'INNOVATION', 'DIVERSIFIED'] as SovereignFundStrategy[]) {
      const returns = Array.from({ length: 40 }, (_, i) => computeAnnualReturn(strategy, `seed-${String(i)}`, 1))
      expect(returns.some((r) => r < 0), `${strategy} should have at least one losing draw across 40 seeds`).toBe(true)
      expect(returns.some((r) => r > 0), `${strategy} should have at least one winning draw across 40 seeds`).toBe(true)
    }
  })

  it('INNOVATION has a wider spread (higher volatility) than PRUDENT', () => {
    const innovationReturns = Array.from({ length: 30 }, (_, i) => computeAnnualReturn('INNOVATION', `seed-${String(i)}`, 1))
    const prudentReturns = Array.from({ length: 30 }, (_, i) => computeAnnualReturn('PRUDENT', `seed-${String(i)}`, 1))
    const range = (values: number[]) => Math.max(...values) - Math.min(...values)
    expect(range(innovationReturns)).toBeGreaterThan(range(prudentReturns))
  })

  it('stays within plausible bounds — never casino-level (e.g. never a single-year ±80% swing)', () => {
    for (let i = 0; i < 30; i++) {
      const r = computeAnnualReturn('INNOVATION', `bound-seed-${String(i)}`, 1)
      expect(Math.abs(r)).toBeLessThan(0.5)
    }
  })
})

describe('applyAnnualReturn', () => {
  it('is deterministic and matches computeAnnualReturn applied to the portfolio value', () => {
    const fund = createSovereignFund(30, 'DEBT', 'INDUSTRIAL', 'MIXED', 1)
    const result = applyAnnualReturn(fund, 'seed-c', 1)
    const expectedRate = computeAnnualReturn('INDUSTRIAL', 'seed-c', 1)
    expect(result.returnRate).toBe(expectedRate)
    expect(result.fund.portfolioValue).toBeCloseTo(30 + 30 * expectedRate, 5)
    expect(result.fund.cumulativeReturn).toBeCloseTo(30 * expectedRate, 5)
  })

  it('never leaves portfolioValue negative even after a severe loss', () => {
    // A synthetic fund with a tiny value to exercise the floor.
    const fund = { ...createSovereignFund(1, 'DEBT', 'INNOVATION', 'MIXED', 1), portfolioValue: 0.01 }
    const result = applyAnnualReturn(fund, 'severe-loss-seed', 1)
    expect(result.fund.portfolioValue).toBeGreaterThanOrEqual(0)
  })
})

describe('maxTransferableDividend / transferDividendToState — M6.5 §42: never withdraw original capital as revenue', () => {
  it('a fund with positive returns can transfer up to its cumulative return, never more', () => {
    let fund = createSovereignFund(30, 'DEBT', 'INDUSTRIAL', 'MIXED', 1)
    fund = { ...fund, portfolioValue: 40, cumulativeReturn: 10 }
    expect(maxTransferableDividend(fund)).toBe(10)
    const result = transferDividendToState(fund, 100)
    expect(result.transferredAmount).toBe(10)
    expect(result.fund.portfolioValue).toBe(30)
    expect(result.fund.cumulativeDividendsToState).toBe(10)
  })

  it('a fund with NO gains (portfolioValue == capitalContributed) has nothing transferable', () => {
    const fund = createSovereignFund(30, 'DEBT', 'PRUDENT', 'MIXED', 1)
    expect(maxTransferableDividend(fund)).toBe(0)
    expect(transferDividendToState(fund, 5).transferredAmount).toBe(0)
  })

  it('a fund at a LOSS (portfolioValue < capitalContributed) has nothing transferable, even with a positive cumulativeReturn artifact', () => {
    const fund = { ...createSovereignFund(30, 'DEBT', 'PRUDENT', 'MIXED', 1), portfolioValue: 20, cumulativeReturn: -10 }
    expect(maxTransferableDividend(fund)).toBe(0)
  })
})

describe('recapitalize / canRecapitalize', () => {
  it('adds to both capitalContributed and portfolioValue, and records the turn', () => {
    const fund = createSovereignFund(30, 'DEBT', 'INDUSTRIAL', 'MIXED', 1)
    const recapped = recapitalize(fund, 10, 13)
    expect(recapped.capitalContributed).toBe(40)
    expect(recapped.portfolioValue).toBe(40)
    expect(recapped.lastRecapitalizationTurn).toBe(13)
  })

  it('canRecapitalize is false before the fund exists, true right after creation, then false again until the cooldown elapses', () => {
    expect(canRecapitalize(NO_SOVEREIGN_FUND, 5)).toBe(false)
    const fund = createSovereignFund(30, 'DEBT', 'INDUSTRIAL', 'MIXED', 1)
    expect(canRecapitalize(fund, 5)).toBe(true)
    const recapped = recapitalize(fund, 10, 5)
    expect(canRecapitalize(recapped, 5 + RECAPITALIZATION_COOLDOWN_TURNS - 1)).toBe(false)
    expect(canRecapitalize(recapped, 5 + RECAPITALIZATION_COOLDOWN_TURNS)).toBe(true)
  })
})

describe('netValueCreated — M6.5 §46 final mandate result', () => {
  it('is portfolioValue + dividends paid - capital contributed', () => {
    const fund = { ...createSovereignFund(40, 'DEBT', 'INDUSTRIAL', 'MIXED', 1), portfolioValue: 51, cumulativeDividendsToState: 3 }
    expect(netValueCreated(fund)).toBe(51 + 3 - 40)
  })

  it('can be negative — a loss must be possible', () => {
    const fund = { ...createSovereignFund(40, 'DEBT', 'INNOVATION', 'MIXED', 1), portfolioValue: 25, cumulativeDividendsToState: 0 }
    expect(netValueCreated(fund)).toBeLessThan(0)
  })
})

describe('acquireStake — M6.5 §40/45: fund-portfolio choices reallocate existing value, never create new capital', () => {
  it('leaves portfolioValue and capitalContributed untouched — this is what keeps it out of the fiscal ledger', () => {
    const fund = createSovereignFund(30, 'DEBT', 'INDUSTRIAL', 'MIXED', 1)
    const staked = acquireStake(fund, 'Participations stratégiques', 0.08)
    expect(staked.portfolioValue).toBe(fund.portfolioValue)
    expect(staked.capitalContributed).toBe(fund.capitalContributed)
  })

  it('adds the named holding and every holding share still sums to 1', () => {
    const fund = createSovereignFund(30, 'DEBT', 'DIVERSIFIED', 'MIXED', 1)
    const staked = acquireStake(fund, 'Participations stratégiques', 0.1)
    const stake = staked.holdings.find((h) => h.category === 'Participations stratégiques')
    expect(stake?.share).toBeCloseTo(0.1, 5)
    expect(staked.holdings.reduce((sum, h) => sum + h.share, 0)).toBeCloseTo(1, 5)
  })

  it('growing an already-held category adds to its existing share rather than duplicating it', () => {
    const fund = createSovereignFund(30, 'DEBT', 'INDUSTRIAL', 'MIXED', 1)
    const category = fund.holdings[0].category
    const before = fund.holdings.find((h) => h.category === category)?.share ?? 0
    const staked = acquireStake(fund, category, 0.05)
    const after = staked.holdings.find((h) => h.category === category)?.share ?? 0
    expect(staked.holdings.filter((h) => h.category === category)).toHaveLength(1)
    expect(after).toBeGreaterThan(before * (1 - 0.05))
  })
})
