# Economic Engine (M1, recalibrated at M1.5)

This document explains Country Run's macroeconomic simulation engine
(`src/engine/economy/`): the units it uses, the order it runs a turn's
calculations in, its formulas, its configuration, and its known
limitations. It is a companion to `docs/ARCHITECTURE.md` (the overall
technical foundation) and to `Country_Run_Product_Bible_V1.docx` §6-§7 (the
product source of truth for what the engine is supposed to feel like).

**M1.5 note:** the first M1 pass produced trajectories that were
directionally correct but economically far too extreme over a 5-year
mandate (e.g. debt ratio swinging from ~111% to ~164% under a strong
investment stance, or collapsing to ~4% under consolidation). M1.5 found
and fixed the root cause — policy inputs were being re-applied every turn
instead of only when they change — and retuned several coefficients
against an approximate France-2027 reference. See "Policy input units"
and "Calibration Status" below for the specifics.

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

## Policy input units — the M1.5 fix

**The root cause of M1's extreme scenario magnitudes**: `EconomicPolicyInput`
fields are documented as a *sustained annualized level* (`publicInvestmentChanges:
10` means "public investment is €10bn/year higher than baseline, for as
long as this value keeps being passed in" — see `types.ts`). The original
M1 code instead treated every nonzero field as a fresh action to repeat
*every turn it was supplied* — so a scenario that sustained the same
policy stance for 30 turns had that stance's spending, revenue, and
structural investment effects added again and again, linearly runaway
over the mandate. A €5bn/year sustained spending increase, held for 5
years, was silently becoming a spending path some €150bn/year higher by
year 5 (30 turns × €5bn) instead of staying at €5bn/year higher — and the
same investment amount was scheduling a brand new structural
productivity-boosting `DelayedEffect` every single turn it stayed active,
stacking dozens of overlapping effects instead of the one the policy
represents.

**The fix**: `computePolicyDelta(current, previous)` (`policyDelta.ts`)
computes the turn-over-turn *change* in policy stance. `advanceEconomy`
calls it once per turn and uses the delta — not the raw level — for
anything that accumulates into a stock or schedules a one-off effect:

- `publicRevenue`/`publicSpending` (`fiscal.ts`) — a sustained policy now
  applies its full effect once, the turn it starts (or changes), then
  holds; an unchanged policy contributes nothing further.
- The structural `DelayedEffect`s scheduled in `productivity.ts`
  (infrastructure/research/education investment, labor-market/public-sector
  reform) — a sustained, unchanged investment schedules nothing further
  after the turn it starts; only a *change* (new or larger investment)
  schedules a new (or incremental) effect.
- The **spending-side** terms of growth's `fiscalImpulse` (`currentSpendingChanges`,
  `publicInvestmentChanges`, `transfersChanges`) — also delta-based. A
  permanently elevated spending level was otherwise re-boosting the growth
  **rate** every single turn for as long as the policy lasted, not just
  during the adjustment period, which was strong enough to raise nominal
  GDP fast enough to fully offset (or overshoot) the extra debt burden in
  ratio terms — silently making sustained investment "pay for itself" and
  sustained consolidation "cost" nothing, the opposite of both scenarios'
  intent. This also matches the Product Bible's own framing (§6,
  "Temporalité des effets") of spending/investment demand effects as a
  12-24 month *adjustment*, not a permanent-for-as-long-as-sustained boost.

**Deliberately still level-based** (not diffed): the growth formula's
**tax-impulse** terms (`businessTaxImpulse`, `householdTaxImpulse`), the
inflation formula's tax pass-through, and the confidence formulas' tax/level
signals. These don't accumulate into a stock the way spending does, so a
sustained policy there produces a bounded, non-explosive, continuous
effect — representing a persistent economic "climate" (a permanently
higher tax burden is a permanently less favorable business environment)
rather than a repeated action. See `types.ts` for the full field-by-field
breakdown of which terms read the level and which read the delta.

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
   effect of this turn's *change* in discretionary spending/investment,
   scaled by `publicSectorEfficiency`, plus the sustained tax-impulse
   level) + external effect (Eurozone/trade growth) + confidence effect
   (using *previous*-turn confidence, to avoid circularity) + productivity
   passthrough + crisis effect (from shocks) + controlled noise.
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

`fiscalImpulse` converts Md€/year policy *changes* into an annualized
growth-pp contribution by dividing by current GDP and scaling by a
per-category multiplier (`config.growth.fiscalMultiplier`). The
spending-side terms (`currentSpendingChanges`, `publicInvestmentChanges`,
`transfersChanges`) use the policy **delta** (see "Policy input units"
above), not the raw sustained level — so this is a temporary adjustment
effect, not a permanent one, matching the tax-impulse terms
(`businessTaxImpulse`, `householdTaxImpulse`), which stay level-based.
Public investment's multiplier is additionally scaled by
`publicSectorEfficiency / 100` (Product Bible §6: "Services publics =
dépenses/investissements × efficacité"). Only the *short-term* multiplier
applies here — long-horizon effects of investment categories go through
delayed effects instead (see "Productivity" below), so growth doesn't
double-count a policy's payoff as both an instant demand bump and a future
productivity bump from the same multiplier.

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

**Every coefficient in `DEFAULT_ECONOMIC_ENGINE_CONFIG` is still
PLACEHOLDER / CALIBRATION NEEDED.** None are VALIDATED FOR GAMEPLAY. M1.5
re-tuned several of them against an approximate France-2027 *calibration
reference* (growth ≈ 0.9%/year, inflation ≈ 1.7%, unemployment ≈ 8.1%,
deficitRatio ≈ 5%, debtRatio ≈ 120% — used to pick plausible starting
magnitudes for the gameplay model, not sourced/official figures — see
`initialState.ts`) so a *neutral* policy stance stays roughly in that
neighborhood over a 5-year mandate instead of drifting toward balance (or
away from it) "for free". None of this makes the numbers scientifically
validated — it makes the starting point for further tuning materially
less broken.

**Logic/unit bugs fixed at M1.5** (these are correctness fixes, not
coefficient tuning — see "Policy input units" above for the full
explanation):

1. `publicRevenue`/`publicSpending` re-accumulated a sustained policy's
   full level every turn instead of only on the turn it changed
   (`fiscal.ts`, now fed the policy *delta* from `advanceEconomy`).
2. `scheduleStructuralDelayedEffects` scheduled a brand new structural
   `DelayedEffect` every turn a sustained investment/reform stayed active,
   instead of only when it changed (`productivity.ts`, same delta fix).
3. Growth's `fiscalImpulse` spending-side terms used the raw sustained
   policy level, letting a permanent spending increase keep re-boosting
   the growth *rate* forever instead of just during the adjustment period
   — strong enough to let investment "pay for itself" and consolidation
   "cost nothing" in the debt ratio, inverting both scenarios' intent
   (`growth.ts`, now uses the delta for these three terms specifically).

**Coefficients changed at M1.5** (`defaultConfig.ts`):

| Coefficient | Old | New | Why |
|---|---|---|---|
| `growth.productivityPassthrough` | 0.5 | 0.15 | Was double-counting productivity's contribution to growth (already counted once via `potentialGrowth`'s own passthrough), keeping growth persistently ~1pp above potential under neutral policy and making unemployment drift down "for free" over 5 years. |
| `growth.externalEurozoneWeight` | 0.3 | 0.15 | Same symptom as above — a *constant* (shock-free) external tailwind was too large a permanent addition to growth under "normal external conditions". |
| `growth.externalTradeWeight` | 0.1 | 0.05 | Same reason as `externalEurozoneWeight`. |
| `inflation.externalPassthrough` | 0.5 | 1.0 | At 0.5, the steady-state inflation was only *half* of the calibration-reference `externalInflation` figure, so the world dataset's stated "1.7% imported inflation" never actually showed up as ~1.7% domestic inflation even absent any other pressure. Full pass-through in the neutral steady state now matches the reference directly. |
| `spending.baselineDrift` | 1.5 | 2.6 | Was below the reference nominal growth (~potentialGrowth + inflation ≈ 2.6%), so under a neutral policy, revenue (which grows with nominal GDP) permanently outpaced spending — deficit and debt ratio drifted toward balance "for free" over 5 years, the opposite of "sticky". Set to match the reference nominal growth rate instead. |
| `revenue.elasticity` | 1.0 | 0.9 | Modest reduction so growth differences between scenarios don't translate quite as strongly into revenue differences — was amplifying the "growth pays for itself" / "growth costs itself" effect described in bug #3 above. |
| `debt.riskPremiumPerConfidencePoint` | 0.03 | 0.015 | The market-confidence → interest-rate feedback loop was strong enough, on its own, to *flip the sign* of a 5-year scenario's debt-ratio outcome (a growth-driven confidence hit under consolidation was raising borrowing costs enough to make consolidation end up with *higher* debt than neutral). Halved to keep it a plausible secondary effect rather than dominating the direct fiscal effect. |
| `confidence.market.growthWeight` | 2 | 1 | Same feedback loop as `riskPremiumPerConfidencePoint` — halved for the same reason, from the other end of the loop. |
| `productivity.infrastructureEffectPerBillion` | 0.002 | 0.006 | After fixing bug #3 (growth's demand impulse is now temporary), a sustained investment policy's *only* lasting GDP effect is through these structural productivity effects — the original magnitudes were too small to produce a visible, non-noise-dominated GDP difference over a 5-year mandate. Roughly tripled. |
| `productivity.researchEffectPerBillion` | 0.003 | 0.008 | Same reason as `infrastructureEffectPerBillion`. |
| `productivity.educationEffectPerBillion` | 0.0015 | 0.003 | Same reason (education's 30-turn delay means it mostly matters for mandates/analyses beyond the 5-year comparison window, but kept proportionate). |

Also changed as **data, not engine coefficients**: `initialState.ts`'s
placeholder starting `EconomicState` and `initialWorldState.ts`'s
`externalInflation` were updated to match the France-2027 calibration
reference above (previously arbitrary round numbers not tied to any
reference point).

The 5-year scenario comparison (`npm run test:scenarios`) is now the
regression suite for "does a policy stance still land in a plausible
band" — see `advanceEconomy.scenarios.test.ts`'s "calibration guardrails"
describe blocks. Further tuning (getting the target bands' *centers*
right, not just avoiding catastrophic magnitudes) remains explicitly
future work.

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
- **Calibration bands, not precise targets, as of M1.5.** The 5-year
  scenario comparison lands within the M1.5 brief's directional bands
  (investment raises debt ratio vs. neutral, consolidation lowers it,
  neither scenario collapses or explodes), but sits toward the *narrower*
  end of some target ranges rather than their center — e.g. the sustained
  investment/consolidation scenarios' debt-ratio spread vs. neutral by
  year 5 is a few points, nearer the lower bound of the brief's "+5 to
  +15pp" / "5 to 15pp below" bands than the middle. Widening that spread
  (larger fiscal multipliers, or simply larger example policy magnitudes)
  is flagged as follow-up tuning, not a defect — the guardrail tests
  assert the *direction* and a *ceiling* on magnitude, not an exact
  target.
