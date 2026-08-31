# Economic Engine (M1)

This document explains Country Run's macroeconomic simulation engine
(`src/engine/economy/`): the units it uses, the order it runs a turn's
calculations in, its formulas, its configuration, and its known
limitations. It is a companion to `docs/ARCHITECTURE.md` (the overall
technical foundation) and to `Country_Run_Product_Bible_V1.docx` §6-§7 (the
product source of truth for what the engine is supposed to feel like).

**This is a gameplay model, not an economic forecasting tool.** Every
coefficient in `engine/economy/config/defaultConfig.ts` is a starting
parameter picked to produce plausible-*feeling*, internally consistent
trajectories — none of them are empirically estimated, and none should ever
be presented to a player, or anyone else, as a validated finding about the
real French economy. See "Calibration Status" below.

## Units

| Field kind | Unit | Examples |
|---|---|---|
| Levels | Md€ (billions of euros) | `gdp`, `nominalGdp`, `debt`, `publicRevenue`, `publicSpending`, `interestCost` |
| Rates | Annualized percent | `growth`, `potentialGrowth`, `inflation`, `productivityGrowth`, `effectiveDebtRate` |
| Percentages | Percent | `unemployment`, `structuralUnemployment`, `deficitRatio`, `debtRatio` |
| Flow balance | Md€ (annualized) | `fiscalBalance` (positive = surplus, negative = deficit), `deficit` (always >= 0) |
| Cumulative index | Percentage points of deviation from the campaign-start baseline (0 at game start) | `purchasingPower` |
| Confidence indices | 0-100 | `consumerConfidence`, `businessConfidence`, `marketConfidence`, `publicSectorEfficiency` |

The flow levels (`publicRevenue`, `publicSpending`, `interestCost`) are
**annualized run-rates** — "at this pace, over a full year" — not the
actual Md€ that changed hands in the last 2-month turn. This matches how
the Product Bible always frames these numbers to the player (annual Md€,
% of GDP) and keeps them directly usable by a future Budget Builder. The
one variable that is NOT a run-rate is `debt`, which is a real
accumulating stock — see "Annualization" below for why that distinction
matters.

## Annualization — the core discipline

The single easiest bug to introduce in a 2-month-turn, 6-turn-per-year game
(Product Bible §2) is applying a full annual rate every turn, which would
compound growth, inflation, or debt six times too fast per year. The
engine avoids this with two explicit, tested conversions
(`annualization.ts`):

- **`annualPercentToPerTurnFraction(rate)`** — for compounding a LEVEL
  (GDP, revenue, spending) by a percentage growth RATE. Divides the annual
  rate by `TURNS_PER_YEAR` (6) and converts it to a fraction, so
  `nextLevel = level * (1 + annualPercentToPerTurnFraction(rate))`. Used
  for GDP, nominal GDP, and the "organic" (elasticity-driven) part of
  revenue and primary spending growth.
- **`annualRateToPerTurnRate(rate)`** — for accumulating a
  percentage-POINT INDEX (`purchasingPower`) by an annualized
  percentage-point rate. Both sides are already "percent", so this is just
  a division by 6, no `/100`.
- **`annualFlowToPerTurnFlow(flow)`** — for turning an annualized Md€/year
  flow into the Md€ that actually elapses in one turn. Used ONLY for the
  debt stock's financing requirement (see "Debt" below) — never for
  updating `publicRevenue`/`publicSpending` themselves, which are run-rate
  *levels*, not accumulating stocks.

The important asymmetry: **already-annualized policy deltas** (e.g.
`taxChanges`, a Md€/year figure from `EconomicPolicyInput`) apply to
`publicRevenue`/`publicSpending` **directly and in full**, the same turn —
they represent "the new run-rate, effective from now", not a rate to
compound. Only *rates* (percentage growth) go through
`annualPercentToPerTurnFraction` before touching a level. Mixing these two
up is exactly the class of bug `annualization.test.ts` and the
`advanceEconomy` integration tests are written to catch.

## Order of execution for one turn

`advanceEconomicTurn` (`advanceEconomy.ts`) is the full pipeline:

1. **`advanceTurn`** (M0, unmodified) — increments `meta.turn`, advances
   the calendar by 2 months, and resolves any `DelayedEffect` whose turn
   has come due (structural productivity/efficiency/unemployment bumps
   from past turns' investments and reforms mature here, *before* this
   turn's economic computation reads those fields).
2. **Shocks** — any `ExternalShock`s passed in are folded onto the
   `WorldState` (`applyExternalShocksToWorld`), and their direct growth
   and confidence deltas are pulled out for later steps.
3. **`potentialGrowth`** — labor + productivity, recomputed fresh from the
   (already-matured) `productivityGrowth` every turn.
4. **`growth`** — potential growth + fiscal impulse (short-term demand
   effect of this turn's discretionary spending/investment/tax deltas,
   scaled by `publicSectorEfficiency`) + external effect (Eurozone/trade
   growth) + confidence effect (using *previous*-turn confidence, to avoid
   circularity) + productivity passthrough + crisis effect (from shocks) +
   controlled noise.
5. **`unemployment`** — Okun's-law-style cyclical response to the
   growth/potential gap, plus a slow drift toward `structuralUnemployment`.
   `structuralUnemployment` itself does not move here — only via matured
   delayed effects from `laborMarketReform`.
6. **`inflation`** — inertia-weighted blend of external inflation, demand
   pressure (growth/potential gap), an energy passthrough from
   `oilPriceIndex`, and a small tax passthrough, plus controlled noise.
7. **GDP levels** — `gdp` and `nominalGdp` updated via
   `annualPercentToPerTurnFraction`, never the raw annual rate.
8. **Debt rate / interest cost** — `effectiveDebtRate` moves only
   partially toward the new borrowing rate (progressive refinancing — see
   "Debt & interest" below); `interestCost` applies that new rate to the
   *previous* debt stock.
9. **Revenue** — organic growth from `nominalGrowth × elasticity`
   (annualized, converted to a per-turn fraction) plus `taxChanges`
   (applied in full) plus a controlled, seed-driven revenue surprise.
10. **Spending** — primary (non-interest) spending drifts at a small
    baseline pace and absorbs this turn's discretionary deltas directly;
    `interestCost` from step 8 is added back on top.
11. **Fiscal balance / deficit** — `fiscalBalance = publicRevenue -
    publicSpending` (positive = surplus); `deficit = max(0,
    -fiscalBalance)`; `deficitRatio = deficit / nominalGdp * 100`.
12. **Debt stock** — accumulates only `1/TURNS_PER_YEAR` of the
    annualized fiscal balance per turn (see "Debt & interest").
    `debtRatio = debt / nominalGdp * 100`.
13. **Purchasing power** — cumulative index update from real income growth
    (nominal income proxy - inflation + transfers effect - household tax
    effect), added via `annualRateToPerTurnRate`.
14. **Confidence** — `marketConfidence` first (debt/deficit ratio levels
    and trajectory, growth), then `consumerConfidence` (employment,
    purchasing power, inflation, market stability), then
    `businessConfidence` (growth, tax, financing cost, market stability,
    consumer demand) — each mean-reverts toward a fundamentals-implied
    target rather than jumping to it, plus any shock delta.
15. **Productivity drift + structural scheduling** — `productivityGrowth`
    only drifts by a tiny configured amount here; this turn's
    `infrastructureInvestment` / `researchInvestment` /
    `educationInvestment` / `laborMarketReform` / `publicSectorReform`
    each schedule a `DelayedEffect` (via M0's unmodified delayed-effects
    system) that matures several turns later.
16. **Invariants** — a narrow set of true bounds (0-100 confidence, no
    negative GDP/debt, unemployment/inflation floor-ceilinged) is applied;
    everything else (deficit ratio, growth, confidence trajectory) is left
    exactly as computed, however extreme.
17. **Diagnostics assembled** — see "Diagnostics" below.

`advanceEconomy` itself (the pure economic step, no calendar/delayed-effect
side effects) is exposed separately for testing and for any caller that
wants to drive the economy without also advancing the turn counter.

## Growth

```
growth = potentialGrowth
       + fiscalImpulse (short-term demand effect of this turn's discretionary policy)
       + externalEffect (Eurozone growth, global trade growth)
       + confidenceEffect (avg. consumer/business confidence deviation from neutral)
       + productivityEffect (passthrough of productivityGrowth)
       + crisisEffect (from active shocks)
       + controlledNoise
```

`fiscalImpulse` converts Md€/year policy deltas into an annualized
growth-pp contribution by dividing by current GDP and scaling by a
per-category multiplier (`config.growth.fiscalMultiplier`). Public
investment's multiplier is additionally scaled by `publicSectorEfficiency
/ 100` (Product Bible §6: "Services publics = dépenses/investissements ×
efficacité"). Only the *short-term* multiplier applies here — long-horizon
effects of investment categories go through delayed effects instead (see
"Productivity" below), so growth doesn't double-count a policy's payoff as
both an instant demand bump and a future productivity bump from the same
multiplier.

## Debt & interest

The ECB rate does not reprice the whole debt stock instantly:

```
newBorrowingRate = ecbRate + baselineSpread + riskPremiumPerConfidencePoint × max(0, 50 - marketConfidence)
effectiveDebtRate(next) = effectiveDebtRate(prev) × (1 - refinancingShare) + newBorrowingRate × refinancingShare
interestCost = effectiveDebtRate(next) / 100 × debt(prev)
```

Only `refinancingShare` (a small fraction, e.g. 8%) of the stock reprices
each turn — this is what makes a sudden ECB hike a *gradual* squeeze on the
budget rather than an instant one, and it's directly tested
(`debt.test.ts`). Lower `marketConfidence` widens the spread, which is the
engine's sovereign-risk feedback loop (no actual default mechanic in M1).

The debt stock itself:

```
financingRequirement(perTurn) = -fiscalBalance / TURNS_PER_YEAR
debt(next) = max(0, debt(prev) + financingRequirement(perTurn) + stockFlowAdjustment / TURNS_PER_YEAR)
debtRatio(next) = debt(next) / nominalGdp(next) × 100
```

Critically, only **one-sixth** of the annualized fiscal balance accumulates
into the debt stock each turn — the debt must not absorb a full year's
deficit every 2-month turn. Because `debtRatio` divides by the *current
turn's* `nominalGdp`, a nominal GDP that grows fast enough can shrink the
ratio even while nominal debt keeps rising — this is exactly what
`debt.test.ts`'s "debt ratio can fall even while nominal debt rises" test
checks.

## Unemployment

```
cyclicalChange = -okunBeta × (growth - potentialGrowth) / TURNS_PER_YEAR
unemployment(next) = clamp(unemployment(prev) + cyclicalChange + (structuralUnemployment(prev) - unemployment(prev)) × meanReversionSpeed, min, max)
```

`structuralUnemployment` never moves in this formula — the only way it
changes is a matured `DelayedEffect` from `laborMarketReform`, scheduled
`structuralReformDelayTurns` turns out, capped at
`structuralReformEffectPerIntensity` points even at full reform intensity.
This is what makes "unemployment 8% → 4% from one decision" structurally
impossible in this engine, not just discouraged by content design.

## Inflation

```
inflation(next) = inertia × inflation(prev) + (1 - inertia) × (external + demandPressure + energy + tax) + noise
```

`inertia` (a fraction close to 1) is what gives inflation memory — a
single-turn shock to `externalInflation` or `oilPriceIndex` only partially
passes through, and the rest phases in over subsequent turns as the
previous-turn term keeps carrying it forward.

## Purchasing power

A **cumulative index**, not a rate (see "Units"). Each turn adds:

```
realIncomeGrowth = (growth + inflation) - inflation + transfersEffect - householdTaxEffect
                  = growth + transfersEffect - householdTaxEffect   (nominal income proxy ≈ nominal GDP growth)
purchasingPower(next) = purchasingPower(prev) + realIncomeGrowth / TURNS_PER_YEAR
```

0 at game start means "no change yet"; a positive value means households
are, on net, better off than at the start of the mandate; negative means
worse off.

## Productivity & structural investment

`productivityGrowth` only changes two ways: a tiny configured per-turn
drift, and `DelayedEffect`s maturing (M0's unmodified delayed-effects
queue). This turn's `infrastructureInvestment`, `researchInvestment`, and
`educationInvestment` each schedule one delayed `add` effect on
`economic.productivityGrowth`, at different horizons matching the Product
Bible's own qualitative multiplier table (§7): infrastructure
medium-term, R&D long-term *and* uncertain (its payoff magnitude gets a
`controlledNoise`-driven multiplier — it can even underperform), education
very slow. `laborMarketReform` and `publicSectorReform` similarly schedule
delayed effects on `structuralUnemployment` and `publicSectorEfficiency`
respectively. None of these are instant, and none reuse or modify the M0
`DelayedEffect`/`scheduleDelayedEffect`/`resolveDueDelayedEffects`
machinery — they're just data fed into it.

## Confidence

`consumerConfidence`, `businessConfidence`, and `marketConfidence` each
mean-revert toward a target implied by this turn's fundamentals
(`target = 50 + weighted signals`), rather than jumping straight to it —
`next = prev + meanReversion × (target - prev) + shockDelta`. This bounds
how fast confidence can move in one turn, which is what keeps the
consumer/business/growth feedback loop from oscillating explosively. Each
function reads the *other* two indices' *previous*-turn value for its
"stability"/"demand" cross-terms, since all three are computed in the same
turn and must not depend on each other's not-yet-computed next value.

## Uncertainty

All noise comes from `controlledNoise(rng, stdDev)` (`noise.ts`): the sum
of three `SeededRng.float(-1, 1)` draws, scaled and averaged, always
bounded to `[-stdDev, stdDev]`. No `Math.random()` anywhere in the engine
— every random draw goes through the M0 `SeededRng`, so the same seed and
the same sequence of engine calls always reproduce the exact same
trajectory (`advanceEconomy.test.ts` and the scenario tests both assert
this directly).

## Diagnostics

`advanceEconomy` returns an `EconomicDiagnostics` object alongside the next
state: `growthContributions` (each term in the growth formula),
`inflationContributions` (each term in the inflation formula),
`confidenceContributions` (the turn's delta for each confidence index),
`revenueSurprise` (the noise-driven Md€ component of revenue, isolated
from the elasticity-driven part), `interestRateChange`, and
`unemploymentChange`. These exist so a future advisor/UI layer can explain
*why* a turn came out the way it did — the engine itself never contains UI
text.

## Configuration

Every coefficient lives in `engine/economy/config/` — nothing is a bare
numeric literal inside a formula file. `types.ts` defines the shape
(`EconomicEngineConfig`); `defaultConfig.ts` provides
`DEFAULT_ECONOMIC_ENGINE_CONFIG`. A future difficulty setting, Daily
Challenge variant, or balance patch changes numbers in one file, never
formula code.

### Calibration Status

**Every coefficient in `DEFAULT_ECONOMIC_ENGINE_CONFIG` is PLACEHOLDER /
CALIBRATION NEEDED.** None are VALIDATED FOR GAMEPLAY yet. They were
picked to be internally consistent and directionally sensible (verified by
the unit tests and the 5-year scenario comparison, `npm run
test:scenarios`), not tuned across many playthroughs. In particular, the
5-year scenario runs show the investment-led and consolidation scenarios
producing quite large swings in `debtRatio` (roughly 118% → 164%, and 111%
→ 4%, respectively, over 30 turns) — directionally correct, but likely too
extreme for a satisfying difficulty curve. Rebalancing
`growth.fiscalMultiplier`, `spending.baselineDrift`, and the
confidence-to-growth feedback strength is flagged as follow-up tuning work,
not a blocking bug — invariants and plausibility checks pass at every turn
in every scenario.

## Limitations

- **A gameplay model, not econometrics.** Every relationship here is a
  deliberately simplified, additive approximation chosen for a
  understandable, replayable game, not derived from empirical estimation
  of the French economy. See Product Bible §19's own methodological note.
- **Linear, not compounding, per-turn scaling.** Annual rates are divided
  by 6 rather than converted via a compounding root — a conscious
  simplification (see "Annualization" above); over a full year it's close
  to, but not identical to, true compounding.
- **The `SeededRng` instance is not itself part of `GameState`.** It's a
  stateful class, not a plain serializable value, so it isn't stored in
  `GameState` — callers own and persist it across turns. A future
  milestone that needs full save/replay support should consider storing
  just the RNG's numeric internal state in `GameState` and reconstructing
  a `SeededRng` from it each turn, rather than the class instance itself.
- **No UI wiring yet.** `app/` still only drives the M0 calendar-only
  `advanceTurn`, not `advanceEconomicTurn` — wiring a persistent,
  correctly-ordered RNG through React state (particularly under
  `<StrictMode>`'s double-invoke behavior) is real design work, deferred
  rather than done hastily here. The engine is fully exercised by its own
  test suite and the scenario tool independent of React.
- **No default sovereign-default mechanic.** `marketConfidence` and the
  interest-rate spread react to a degrading trajectory, but there's no
  simulated debt crisis / default event in M1 (Product Bible-consistent:
  that's a bigger design question for a later milestone, if ever).
