# Country Run — M6: Economic Precision & Complete Budget Builder

M6 builds a full public-finance decomposition on top of the M0–M5
architecture, without redesigning the M1.5 economic engine. This document
records the decomposition, the reconciliation rules, the revenue/tax model,
pensions, service indices, the fiscal ledger, the forecast engine, primary
balance/debt stabilization, provenance, policy-level semantics, temporary
measures, and known calibration placeholders.

## 1. The non-negotiable rule (unchanged from M1.5, exercised harder in M6)

`EconomicPolicyInput` fields are **ANNUALIZED POLICY LEVELS**, not per-turn
additions. `computePolicyDelta(current, previous)` inside `advanceEconomy`
turns two consecutive absolute levels into the one-time marginal change the
revenue/spending formulas actually apply. M6 generalizes this from "one
persistent Budget Builder total" (M5) to **13 independently-timed finance
blocks plus every reform/event/concession**, all funnelled through the same
`implementedReformPolicies` accumulator (see §7).

Worked examples, all covered by regression tests
(`finance/financeEffects.test.ts`, `app/gameReducer.m6.test.ts`):

- Health +10 / +10 / +10 across 3 consecutive budgets → the level **stays**
  +10, never accumulates to +30.
- Household tax +6 then unchanged the next year → no further scheduled
  change.
- Pensions cut then reverted to "Protéger" → the reversal applies exactly
  once, as a negative delta.

## 2. Public finance baseline (unchanged — never silently replaced)

The calibrated France 2027 starting state remains
`data/initialState.ts`'s `PLACEHOLDER_ECONOMIC_STATE`:

| Field | Value |
|---|---|
| Nominal GDP | 2 800 Md€ |
| Public revenue | 1 372 Md€ (≈49.0% GDP) |
| Public spending | 1 512 Md€ (≈54.0% GDP, includes interest) |
| Interest cost | 100.8 Md€ |
| Deficit | 140 Md€ (5.0% GDP) |
| Debt | 3 360 Md€ (120.0% GDP) |

M6's 9 spending blocks + locked interest, and 4 controllable + 1 residual
revenue block, are a **gameplay decomposition** of these same totals —
never a second, independent economic model.

## 3. Data provenance

Every finance block config (`finance/spendingBlocks.ts`,
`finance/revenueBlocks.ts`) carries a `provenance` field:

- **OBSERVED** — a real historical figure (not used for the 2027
  gameplay baseline itself, since 2027 is the game's forecast starting
  point, not an already-observed year).
- **FORECAST** — a plausible extrapolation.
- **GAME_ESTIMATE** — a gameplay-design number picked to feel meaningful
  at Country Run's scale, not sourced (this is what every M6 baseline
  envelope actually is — the same honesty standard `budgetCategories.ts`
  already used in M2/M5).
- **SIMULATED** — the output of the economic engine itself (e.g. the live
  `publicRevenue`/`publicSpending`/`interestCost` read every turn).

No 2027 invented figure is ever labeled OBSERVED.

## 4. Spending decomposition (9 controllable blocks + locked interest)

| Block | Baseline (Md€/yr) | Engine field(s) |
|---|---:|---|
| Pensions | 335 | `transfersChanges` (exclusively — see §8) |
| Health | 220 | `currentSpendingChanges` |
| Solidarity | 225 | `currentSpendingChanges` |
| Education | 125 | `educationInvestment` |
| Économie & investissement | 140 | `currentSpendingChanges` / `infrastructureInvestment` / `researchInvestment` / `publicInvestmentChanges`, by tier |
| Défense | 45 | `currentSpendingChanges` |
| Sécurité | 43 | `currentSpendingChanges` |
| Territoires/logement/environnement/culture | 95 | `publicInvestmentChanges` / `infrastructureInvestment` / `currentSpendingChanges`, by tier |
| Administration | 183 | `currentSpendingChanges` + `publicSectorReform` |
| **Charge de la dette** (locked) | ≈101 (reference only) | never a tier — `economic.interestCost`, computed fresh every turn |

Sum of the 9 controllable baselines: **1 411 Md€**. Plus the interest
reference (**101 Md€**) = **1 512 Md€ = the calibrated `publicSpending`
exactly**. Administration's baseline is the one figure picked to close the
sum exactly (the brief's own allowance for "a documented small
reconciliation residual") — every other baseline is a proportional scale
of the brief's own reference magnitudes.

**No double counting**: pensions and solidarity are separate blocks
(`transfersChanges` reserved for pensions alone; solidarity uses
`currentSpendingChanges` — see §8's note on why this separation matters for
promise evaluation); investment lives only in Économie&Investissement/
Territoires; debt interest is never one of the 9 blocks.

## 5. Revenue decomposition (4 controllable blocks + 1 residual)

| Block | Baseline (Md€/yr) | Share |
|---|---:|---:|
| Cotisations sociales | 615 | ≈44.8% |
| Fiscalité de la consommation (TVA, indirects) | 275 | ≈20.0% |
| Fiscalité des ménages | 245 | ≈17.9% |
| Fiscalité des entreprises | 135 | ≈9.8% |
| Autres recettes publiques (non pilotable) | 102 | ≈7.4% |

Sum: **1 372 Md€ = the calibrated `publicRevenue` EXACTLY**. "Other public
revenue" is never a tier — it is displayed as the residual
`publicRevenue - Σ(4 controllable blocks' projected amount)`
(`finance/financeEffects.ts`'s `otherRevenueEstimate`), so the 5 blocks
always sum to the real simulated total, whatever policy has changed.

## 6. Reconciliation test result

`finance/financeEffects.test.ts`'s reconciliation suite confirms:
- `SPENDING_BASELINE_TOTAL` (1 512) matches `publicSpending` (1 512)
  exactly, residual **0 Md€**.
- `REVENUE_BASELINE_TOTAL` (1 372) matches `publicRevenue` (1 372)
  exactly, residual **0 Md€**.
- No spending block's id or config references `interestCost`/
  `effectiveDebtRate` — interest is never represented twice.

## 7. Policy tiers (M6 §7)

Every block has 4-5 tiers (`FinanceTier` in `finance/financeTypes.ts`),
each carrying: `id`, `label`, `annualFiscalDelta`, `policyEffect`
(the ABSOLUTE `Partial<EconomicPolicyInput>` this tier contributes),
`description`, `implementationTiming`, `temporaryOrPermanent`,
`economicEffects`, `publicServiceEffects`, `politicalTags`,
`promiseLinks`, `riskDescription`. No continuous sliders anywhere.

Worked Health example (matches the brief's own): Efficiency Drive −8,
Control Spending −3, Maintain 0, Hospital Plan +10, Major Rebuild +20.

**Scheduling architecture**: a tier is never folded into the running
policy total the instant it's selected. On budget adoption,
`finance/financeEffects.ts`'s `computeFinanceChanges` diffs the DRAFT
selections against the currently-ENACTED ones; each CHANGED block is
scheduled via the *same* `parliament/implementationSchedule.ts` queue a
reform bill already used, at `nextYearStartTurn + tier.implementationTiming`.
This unifies M6 finance blocks and M4/M5 reform bills onto one
scheduling mechanism: both feed `implementedReformPolicies` a one-time
delta exactly once, when the change matures — never a re-derived absolute
level. `financeLevels` (the persisted tier id per block) is DISPLAY state
only.

## 8. Pensions

Real budget lever, 5 tiers: Protect (0), Limit Indexation (−6),
Targeted Reform (−12), Structural Reform (−22, `implementationTiming: 5`,
plus a small `laborMarketReform` nudge), Protect Purchasing Power (+8).
Structural reform's saving phases in over 5 turns via the scheduling
mechanism in §7 — it is never subtracted instantly. `transfersChanges` is
reserved EXCLUSIVELY for pensions among the 9 spending blocks (solidarity
uses `currentSpendingChanges` instead) specifically so
`gameReducer.ts`'s `advanceTurnAction` can tag a matured reform's
`policyHistory` entry `category: 'pensions'` from its `policyEffect`
shape alone, without conflating the two.

## 9-16. Health, Education, Solidarity, Economy & Investment, Defense, Security, Territories, Administration

Each is a genuine budget lever with 4-5 tiers (see `finance/spendingBlocks.ts`
for full copy/effects/risk text). Health/Education/Security/Administration
each drive a gradual `ServiceIndices` response (§45). Économie &
Investissement's sub-choices route through DIFFERENT engine fields per
tier (Business Support → `currentSpendingChanges`, Infrastructure →
`infrastructureInvestment`, Industry&Innovation → `researchInvestment`) so
the character of the spending genuinely differs without a second Budget
Builder. Territories similarly differentiates Housing/Green/Territorial
orientations. Administration's Digitalization tier is a small persistent
cost (`currentSpendingChanges: -3` net, i.e. modest net savings) plus a
`publicSectorReform` intensity that phases in via the ENGINE's own
`publicSectorReformDelayTurns` config (already present in M1.5 —
reused, not reinvented) — Deep Cuts is a larger, immediate, higher-risk
cut.

## 17-18. Debt interest

**Audited, unchanged, no engine work required.** `computeEffectiveDebtRate`
(`engine/economy/debt.ts`) already reprices GRADUALLY through a
`refinancingShare` of the debt stock toward a new borrowing rate
(ECB rate + baseline spread + a risk premium that widens as
`marketConfidence` falls) — this already satisfies M6 §59's stress-test
requirement ("gradual, not instant repricing") with zero changes.
`computeInterestCost = effectiveRate × debtPrev` is computed exactly
once per turn; `computePublicSpending` layers it onto primary spending
exactly once (`primarySpendingNext + interestCostNext`); `computeFiscalBalance`/
`computeDebt` both correctly use the interest-inclusive `publicSpending`.
No M6 spending block represents interest a second time. M6's only work
here is DISPLAY: a locked "CHARGE DE LA DETTE" card (Budget Builder,
Year/Mandate Review, DetailPanel) reading `economic.interestCost` and
`debtInterestShareOfSpending` directly.

## 19-27. Revenue side and the M6 tax-revenue fix

**The bug, isolated and documented before any fix, per the brief's
instruction.** Before M6, every tax-related content site (`business-tax-cut-bill`,
`household-tax-cut-bill`, `industry-innovation-plan-bill`, 2 events,
1 concession) set only `businessTaxImpulse`/`householdTaxImpulse`
(confidence/inflation side effects) — never `taxChanges`, the ONLY field
`computePublicRevenue` actually reads. `EconomicPolicyInput`'s own doc
comment describes this as a caller responsibility
("used both for their revenue impact via `taxChanges`, which the caller
is responsible for keeping consistent"). No Country Run content ever
honored it. **Net effect: every tax policy in the entire pre-M6 game had
ZERO impact on public revenue, deficit, or debt** — only on confidence/
inflation/purchasing power.

The engine's own contract is correct and intentional (§69: keep `engine/`
generic); the fix belongs entirely at the content layer. M6's fix:

1. Every revenue-block tier now sets `taxChanges` alongside its impulse
   field(s), to the same magnitude (household/business tax) or a
   documented partial pass-through (social contributions:
   `businessTaxImpulse` at 50% of the `taxChanges` magnitude, since
   employer charges read as a business cost signal, not a full 1:1
   confidence shock).
2. The 6 pre-existing content sites (`bills.ts` ×3, `eventCatalog.ts` ×2,
   `concessions.ts` ×1) are retrofitted the same way, each with an inline
   comment pointing back to this fix.
3. Regression tests in `finance/financeEffects.test.ts` assert every
   controllable revenue tier's `effectDelta` includes BOTH fields.

**Consumption tax (§23)**: its revenue effect (`taxChanges`) is
PERMANENT, but its inflation/confidence effect is a SEPARATE, TEMPORARY
(6-turn / 1-year) `householdTaxImpulse` impulse, scheduled and reversed
through the fiscal ledger's expiration mechanism (§39) — matching how a
real VAT change drops out of the y/y inflation base after a year, rather
than injecting the same inflation shock every turn the new rate stays in
place (the literal failure mode the brief calls out).

**Structural vs cyclical (§27)**: `finance/fiscalLedger.ts`'s
`structuralRevenueChange` sums ledger-driven (policy) revenue changes
over a turn window; the residual (engine `revenueSurprise`, growth-
driven) is cyclical. No internal engine coefficient is ever exposed.

## 28-31. Budget equation & comparison UI

`finance/financeEffects.ts`'s `computeBudgetEquation` reads
revenue/spending/balance/deficit straight off the real `EconomicState`,
in both Md€ and %GDP — never re-derived from the block breakdown, which
is a display decomposition only. The Budget Builder's `FinanceBlockCard`
shows "politique actuelle → nouveau choix → changement" whenever the
draft differs from the enacted tier (M6 §29). §30's base-envelope vs
presidential-adjustment distinction is the card's header (`baseline` Md€)
vs. its tier button deltas.

## 32-33. Forecast engine

`finance/budgetForecast.ts`'s `forecastNextYear` is PURE — it runs the
real, calibrated M1.5 engine forward exactly one gameplay year (6 turns)
under 3 isolated forecast-only seeds, never touching real game state
(`advanceEconomicTurn` already returns fresh objects). The 3-run spread
becomes the displayed low/central/high range; a `widthMultiplier`
(intended to be driven by `governmentEffects.ts`'s
`fiscalEstimateRangeWidth`) further widens/narrows the range and derives
a HIGH/MEDIUM/LOW confidence label. **Known limitation**: this module is
fully implemented and tested (`finance/budgetForecast.test.ts`: purity,
determinism, ranges, confidence labeling, policy sensitivity) but is
**not wired into a live UI screen** in this milestone — see "Known
limitations" below.

## 34. Note de Bercy

`app/components/BudgetSummary.tsx` is the sticky Budget Builder summary,
rebuilt as a neutral "NOTE DE BERCY": recettes/dépenses/solde (Md€ and
%GDP), solde primaire, charge de la dette, effort de stabilisation de la
dette, changement structurel net, principaux risques (from changed
tiers' `riskDescription`), impact sur les engagements (from changed
tiers' `promiseLinks` matched against selected promises). Never
"bon"/"mauvais budget" — only factual, comparative statements.

## 35-37. Debt trajectory, primary balance, debt stabilization

`finance/primaryBalance.ts`: `primaryBalance = fiscalBalance + interestCost`
("solde avant paiement des intérêts de la dette", shown verbatim in the
glossary). Debt stabilization uses the standard approximate identity
`stabilizingDeficitRatio ≈ (nominalGrowth / (100 + nominalGrowth)) ×
debtRatio`; `gap = currentDeficitRatio - stabilizingDeficitRatio`. Shown
on the Budget Summary, Year Review, and (as a %GDP figure) throughout.
No hidden second economy — this is a transparent approximation over the
same calibrated dynamics the engine already implements.

## 38-39. Policy impact cards & temporary/permanent

Every `FinanceTier` exposes `economicEffects`/`publicServiceEffects`/
`riskDescription`/timing in `FinanceBlockCard`'s expandable "Détails"
section. `temporaryOrPermanent` is explicit on every tier. Temporary
measures (currently: the consumption-tax inflation impulse, §23; and the
`tax-shortfall` event's "MESURE FISCALE TEMPORAIRE" choice, retrofitted
with `EventChoice.temporaryPolicy: { durationTurns: 6 }`) expire
automatically, EXACTLY ONCE, via `finance/fiscalLedger.ts`'s
`dueLedgerExpirations`/`expirationPolicyEffect`, folded into
`implementedReformPolicies` the turn `endTurn` is reached — proven by
the worked example in `finance/fiscalLedger.test.ts` and the end-to-end
reducer test in `app/gameReducer.m6.test.ts` (fires, is felt, expires,
does not re-fire).

## 40-41. Fiscal ledger

`finance/financeTypes.ts`'s `FiscalLedgerEntry` + `finance/fiscalLedger.ts`.
An entry is appended at the EXACT moment its `policyEffect` is scheduled
for `implementedReformPolicies` (budget blocks on adoption, reform bills
on adoption, event choices on the turn chosen, concessions on adoption) —
never maintained as an independent parallel total. `sumActiveLedgerPolicyEffect`
sums every entry whose `startTurn <= currentTurn < (endTurn ?? ∞)`; this
is provably reconcilable against `implementedReformPolicies` because both
are built from the same source events (see `app/gameReducer.m6.test.ts`'s
"fiscal ledger reconciliation" test, which asserts field-by-field
equality after a full turn). Ledger entry ids are fully deterministic
(`sourceId:startTurn:index`), never a mutable module counter — required
for save/reload and same-seed replay determinism (M5 §57).

## 42-44. Causal explanations upgrade

`mandate/economicExplanation.ts` gains `explainDeficitChange` (this
turn's recorded policy decisions + the engine's own `revenueSurprise`/
`interestRateChange` diagnostics), `explainDebtChange` (primary deficit /
nominal growth denominator effect / interest burden), and
`explainPurchasingPowerChange` (inflation level + this turn's recorded
decisions). Every driver is either a real diagnostics field or an actual
`policyHistory` entry — never invented.

## 45-46. Service indices

`finance/serviceIndices.ts`: `health`/`education`/`security`/
`administration`, baseline 100 (`NEUTRAL_SERVICE_INDICES`), each a
DAMPED drift toward `100 + fundingDelta × 0.5 (+ reformLevel × 8 for
administration)`, closing 5% of the remaining gap per TURN
(`driftRatePerTurn: 0.05`) — clamped to [60, 140] as a safety bound. A
sustained +10 Md€/year health budget does not instantly raise the index
by anything; it converges toward +5 points over many turns (proven in
`finance/serviceIndices.test.ts`). Housing/environment/culture's
combined index, which the brief marks OPTIONAL, was not built (documented
scope decision below).

## 47-50. Promise integration

Rewired onto real M6 levers, replacing the M3-era `evaluateUnavailableLever`
stand-in on 5 promises:

- `cut-household-taxes` / `cut-business-taxes` → `evaluateTaxCutCommitment`:
  KEPT once a sufficient cut tier (or the matching reform bill) is ever
  adopted.
- `no-tax-increase` → `evaluateNoTaxIncrease`: a **ratchet** — ANY
  adopted household/business/consumption/social-contribution increase,
  ever, breaks it permanently, even if later reversed (§48's explicit
  semantics, proven by a dedicated regression test).
- `protect-pensions` → `evaluatePensionProtection`: BROKEN if pension
  spending was EVER cut (any negative `pensions`-category policyHistory
  entry), regardless of later increases — never inferred from total
  social spending (solidarity is a separate category).
- `restore-public-services` → `evaluateServiceIndexCommitment`: reads the
  composite of the 4 service indices (§45), documented ±3-point
  KEPT/PARTIAL/BROKEN thresholds.

`energy-transition`/`build-housing` remain on the shared `investment`
policyHistory category (a documented, deliberately-unchanged M3 scope
decision) — both are naturally satisfied by Économie&Investissement's
Infrastructure/Industry&Innovation tiers or Territories' Housing/Green
tiers.

`policyHistory` entries for finance decisions are now built ONLY on
ADOPTION (`finance/financeEffects.ts`'s
`policyHistoryEntriesFromFinanceChanges`, called from
`gameReducer.ts`'s `applyAdoptedBudget`) — an M6 correctness fix over M5,
which recorded budget-category entries at SUBMIT time, before Parliament
had voted, so a promise could be (dis)satisfied by a budget line that was
never actually enacted.

## 51-53. Budget Bill & Parliament integration

`parliament/budgetBillDerivation.ts`'s `deriveBudgetBill` now takes the
full `FinanceBlockChange[]` (spending AND revenue) computed by
`computeFinanceChanges` — the exact same array `gameReducer.ts` uses to
schedule the real implementations, so the bill's `economicPolicyEffect`/
`fiscalCost`/`policyTags` can never drift from what actually gets
enacted. `policyTags` are derived from each CHANGED block's magnitude/sign
against the real `PolicyDimension` set (now finally exercising
`pensions`/`businessTax`/`householdTax`, previously dead weight since no
M5 budget lever touched them) — never hand-authored per tier (§52).

**Concession fix (§53)**: M5's Budget Bill folded concessions into the
vote's `EffectiveBill` for support/controversy math, but NEVER scheduled
their fiscal effect for the persistent policy total — a granted
concession on the mandatory Budget Bill was, until M6, entirely
cosmetic. `gameReducer.ts`'s `applyAdoptedBudget` now computes
`diffPolicyEffect(effectiveBill.economicPolicyEffect, definition.economicPolicyEffect)`
(the concession-only delta) and schedules/ledgers it exactly once,
alongside the per-block changes — proven end to end in
`app/gameReducer.m6.test.ts`.

## 54-59. Magnitude audit

6 five-year scenarios were run (see the final report's comparison
table). Results diverge meaningfully: debt ratio spans ~124% (A Strong
Consolidation) to ~154% (B Expansionary), a ~30-point spread; deficit
spans 4.7%–12.7%. A Strong Consolidation nearly stabilizes the debt ratio
(123.7% vs. a 120.0% starting point) — a disciplined strategy CAN
materially improve the trajectory, at a real popularity/service-index
cost, without ever guaranteeing debt reduction (all 6 scenarios still end
above the 120% starting ratio — 5 years is not long enough to fully repay
M1.5's calibrated primary deficit even under consolidation, which is the
expected, honest outcome). B Expansionary and D Tax Cutter both worsen
the deficit materially relative to F Balanced — "no free lunch" holds for
both spending-driven and tax-cut-driven expansion. All 6 stay within the
M6 §76 plausibility gates (deficit < 15%, debt < 180%, positive
unemployment, no service-index blow-up, revenue/spending well under the
70%/80% GDP ceilings). The debt-interest gradual-repricing stress test is
already covered by the existing, unmodified `engine/economy/debt.test.ts`
suite (confirmed during the M6 audit — no engine change was needed) and
is additionally visible in the B Expansionary scenario's interest cost
nearly doubling (100.8 → ~193 Md€) as debt and confidence deteriorate
over the 5 years, gradually, turn by turn.

## 60. Structural vs cyclical revenue — see §27.

## 61. Causal explanations — see §42-44.

## 62. Promise evaluators — see §47-50.

## 63. Budget Bill / Parliament — see §51-53.

## 64-66. UI

Budget Builder: HEADER (macro situation incl. locked interest) / RECETTES
(4 cards) / DÉPENSES (9 cards + locked interest card) / sticky NOTE DE
BERCY summary, every block card using progressive disclosure (`<details>`
"Détails" — tier buttons and the current tier's short description are
always visible; economic/service effects, risk, timing, and the
reference-envelope provenance line are behind one tap). Year Review gains
a "Finances publiques" card (primary balance, interest share, debt
stabilization gap) and a service-index card. Mandate Review gains a full
2027→2032 public-finance decomposition (revenue, spending incl. interest,
interest alone, primary balance, deficit, debt).

## 65. French formatting & glossary

`app/format.ts` gains locale-correct helpers (`formatMdFr`,
`formatSignedMdFr`, `formatPercentFr`, `formatSignedPercentFr`, all via
`toLocaleString('fr-FR')` — comma decimals, space thousands separators,
e.g. "1 590 Md€", "5,2 %"), used throughout the NEW M6 finance UI. A
compact static glossary (`<details>` block in the Budget Builder screen)
covers PIB/déficit/dette/solde primaire/charge de la dette/prélèvements
obligatoires/croissance nominale.

## 67-70. Testing

See the final milestone report for the full test count, the
anti-accumulation regression results, and the 3-run manual browser
validation notes.

## Architecture boundaries (§69-70)

Everything new lives under `src/game/country-run/finance/` — the generic
`engine/` package is untouched (confirmed: zero diffs under `src/engine/`
in this milestone; the only "fix" is at the content layer, per §1's
audit). `finance/budgetForecast.ts` never mutates real state; its
output is explicitly a forecast/estimate, distinct from the turn-by-turn
SIMULATED figures the rest of the UI shows.

## Known limitations (honest, documented)

1. **Forecast UI not wired into a live screen.** `finance/budgetForecast.ts`
   is complete, pure, and tested, but the Budget Builder's live summary
   uses only current-state-derived figures (no simulated forward range) —
   running a 3-seed, 6-turn forward simulation on every keystroke was
   judged not worth the added complexity/latency for this milestone,
   especially given M6 §78's explicit instruction to prioritize clarity
   over added screens. A future milestone can surface it on the
   post-adoption "budget result" moment.
2. **French locale formatting is not retrofitted across every pre-existing
   M0-M5 screen** — only the new M6 finance UI uses `formatMdFr`/
   `formatPercentFr`; older screens keep their existing `.toFixed()`-based
   formatting (`formatPercent`/`formatMdEuros`) to avoid an unrelated,
   risk-bearing sweep across already-tested, already-shipped UI.
3. **Housing/environment/culture combined service index** — marked
   OPTIONAL in the brief, not built. Territories stays a spending block
   without its own dedicated index.
4. **Économie & Investissement / Territories sub-choice routing** is a
   simplification: each tier routes through ONE primary engine field
   rather than a fully independent sub-model, per the brief's own
   "avoid a second full Budget Builder" instruction.
5. **`energy-transition`/`build-housing` promises** still share the
   generic `investment` policyHistory category rather than a dedicated
   lever (an M3-era scope decision, left unchanged — both are now
   naturally satisfiable through several M6 finance blocks).
6. **Social contributions' business-confidence pass-through (50%)** and
   every tier's `annualFiscalDelta` magnitude are documented gameplay
   calibration placeholders, not sourced fiscal estimates — consistent
   with every other Country Run content file's existing disclaimer.
