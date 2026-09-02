# Country Run — France 2027 Baseline (M6.1)

This replaces the M0-M6 placeholder dataset (`data/initialState.ts`'s old
`PLACEHOLDER_ECONOMIC_STATE`, explicitly labeled "NOT REAL DATA"). Country
Run's mandate begins **May 2027**. Every figure below is either an
**OBSERVED** anchor or a **FORECAST/GAME_ESTIMATE** derived from it — no
2027 figure is ever labeled OBSERVED.

## 1. The observed 2025 anchor

Source: **Insee, French public accounts 2025**, published May/August 2026.

| Variable | Value | Definition | Status |
|---|---|---|---|
| Nominal GDP | €2,991bn | Gross domestic product at current prices, 2025 | OBSERVED |
| Public revenue | 52.2% GDP | Total general-government revenue (Maastricht/ESA2010 basis) | OBSERVED |
| Public expenditure | 57.3% GDP / €1,714.1bn | Total general-government expenditure | OBSERVED |
| Public deficit | €152.5bn | Expenditure − revenue | OBSERVED |
| Deficit ratio | 5.1% GDP | Deficit / nominal GDP | OBSERVED |
| Public debt | €3,460.5bn | Gross Maastricht debt | OBSERVED |
| Debt ratio | 115.7% GDP | Debt / nominal GDP | OBSERVED |
| Interest expenditure | €64.7bn | General-government interest expense (national accounts) | OBSERVED |
| Compulsory levies | 43.6% GDP | Taxes + social contributions (a subset of "public revenue" above — public revenue also includes non-compulsory receipts) | OBSERVED |

Retrieval date for this milestone: 2026-09 (per the M6.1 brief).

## 2. Bridging to May 2027 (game start)

Source for macro trajectory: **Banque de France, June 2026 projection.**

| Variable | 2027 value | Status |
|---|---|---|
| Real GDP growth | ~0.9% | FORECAST |
| HICP inflation | ~1.7% | FORECAST |
| Unemployment | ~8.1% | FORECAST |
| Public balance (2026 baseline) | ~−5.2% GDP | FORECAST (context for the derivation below) |
| Debt trajectory | "continues rising toward ~122% GDP in 2028" | FORECAST (context) |

These three 2027 figures (growth/inflation/unemployment) are used directly
as `EconomicState.growth`/`inflation`/`unemployment` — no further
derivation needed for those.

### 2.1 Nominal GDP

No separate 2026 macro figure was published in this milestone's source
material, so — as a **documented simplifying assumption**, not a second
forecast — the 2027 nominal growth rate (real 0.9% + inflation 1.7% =
**2.6%/year**) is applied flat across both bridge years (2026 and 2027):

```
nominalGdp(2027) = 2,991 × 1.026² ≈ 3,148.6 → rounded to 3,150 Md€
```

Status: **GAME_ESTIMATE** (a documented 2-year bridge, not a sourced 2027
GDP forecast).

### 2.2 Debt ratio

Interpolated between the 2025 observed 115.7% and the "~122% GDP by 2028"
trajectory point, assuming a roughly smooth glide path (~2pp/year):

```
2025: 115.7%  →  2026: ~117.9%  →  2027: ~120.0%  →  2028: ~122.0%
```

**Debt ratio 2027 ≈ 120.0%** (GAME_ESTIMATE, interpolated).

```
debt(2027) = 3,150 × 1.200 = 3,780 Md€
```

### 2.3 Deficit ratio

The brief's source material states "only limited deficit improvement"
after 2026's ~−5.2%. This is modeled as a modest, explicitly-assumed
improvement to **5.0% GDP** for 2027 — a documented judgment call, not a
computed figure.

```
deficit(2027) = 3,150 × 0.050 = 157.5 → rounded to 158 Md€
```

Status: **GAME_ESTIMATE**.

### 2.4 Revenue / expenditure split

The 2025 observed revenue ratio (52.2% GDP) is held roughly flat at
**52.0% GDP** for 2027 (no major legislated revenue shift is assumed for
this bridge). The expenditure ratio is then whatever is REQUIRED to hit
the 5.0% deficit target above — it is never invented independently of the
deficit identity:

```
publicRevenue(2027)   = 3,150 × 0.520 = 1,638 Md€
expenditureRatio(2027) = revenueRatio + deficitRatio = 52.0% + 5.0% = 57.0%
publicSpending(2027)  = 3,150 × 0.570 = 1,795.5 → rounded to 1,796 Md€
```

Check: 1,796 − 1,638 = 158 ✓ (matches §2.3's deficit exactly).

Status: **GAME_ESTIMATE** (revenue ratio held flat by assumption;
expenditure ratio derived from the deficit identity, not assumed
independently).

### 2.5 Interest expenditure

**M6.1 §6's explicit warning is honored here**: the starting interest
cost is NOT "3% × gross Maastricht debt" — that conflates the Maastricht
debt CONCEPT with an arbitrary flat rate. Instead:

1. The 2025 OBSERVED effective rate is computed against the SAME
   Maastricht debt stock `debt`/`debtRatio` already track in this game
   (both are ESA2010/Maastricht concepts, so this is a like-for-like
   ratio, not a mismatched accounting comparison):
   ```
   effectiveRate(2025) = 64.7 / 3,460.5 ≈ 1.87%
   ```
2. A modest further uptick to **~2.0%** is assumed for 2027 — consistent
   with continued GRADUAL refinancing at higher market rates as older,
   cheaper debt matures and rolls over. This is the SAME gradual
   refinancing mechanism `engine/economy/debt.ts`'s
   `computeEffectiveDebtRate` already implements turn to turn (see
   `docs/ECONOMY_BUDGET_M6.md` §17-18's audit) — this is only its
   documented STARTING value, not a new mechanism.
   ```
   interestCost(2027) = 3,780 × 0.020 = 75.6 → rounded to 76 Md€
   ```

Status: **GAME_ESTIMATE** (rate assumption), computed against an
**OBSERVED**-anchored ratio.

## 3. Final France 2027 baseline (game start)

| Variable | Value | Status |
|---|---:|---|
| Nominal GDP | 3,150 Md€ | GAME_ESTIMATE |
| Real growth | 0.9%/yr | FORECAST |
| Inflation | 1.7%/yr | FORECAST |
| Unemployment | 8.1% | FORECAST |
| Public revenue | 1,638 Md€ (52.0% GDP) | GAME_ESTIMATE |
| Public spending | 1,796 Md€ (57.0% GDP) | GAME_ESTIMATE |
| Deficit | 158 Md€ (5.0% GDP) | GAME_ESTIMATE |
| Debt | 3,780 Md€ (120.0% GDP) | GAME_ESTIMATE |
| Effective debt rate | 2.0%/yr | GAME_ESTIMATE |
| Interest cost | 76 Md€ | GAME_ESTIMATE |

## 4. Consistency identities (enforced by `data/initialState.test.ts`)

- `publicRevenue / nominalGdp ≈ 52.0%`
- `publicSpending / nominalGdp ≈ 57.0%`
- `(publicSpending − publicRevenue) / nominalGdp ≈ deficitRatio (5.0%)`
- `debt / nominalGdp ≈ debtRatio (120.0%)`
- `interestCost ≈ effectiveDebtRate% × debt` (76 ≈ 2.0% × 3,780 = 75.6)

## 5. What did NOT change

`growth` (0.9%), `inflation` (1.7%), and `unemployment` (8.1%) were
already correct under the old placeholder (it happened to already match
the Banque de France 2027 projection) — only the SCALE (GDP, revenue,
spending, debt, interest) was wrong, since the placeholder's absolute
Md€ figures were picked to be "roughly plausible" rather than derived
from real French public accounts. `productivityGrowth`,
`consumerConfidence`, `businessConfidence`, `marketConfidence`,
`publicSectorEfficiency`, `purchasingPower`, and the political/social
starting state are unrelated to the fiscal rebaseline and are unchanged.

## 6. Downstream reconciliation

The M6 finance decomposition (`docs/ECONOMY_BUDGET_M6.md`) is rebuilt
against this baseline in M6.1 — see that document's updated §2-6 for the
9 spending blocks / 4+1 revenue blocks reconciled to 1,720 Md€ primary
spending + 76 Md€ interest = 1,796 Md€, and 1,638 Md€ revenue.
