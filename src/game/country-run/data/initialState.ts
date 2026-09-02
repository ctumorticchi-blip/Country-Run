import type { GameState, Seed } from '../../../engine/state/gameState.ts'

const GAME_START_YEAR = 2027
const GAME_START_MONTH = 5 // May — the mandate's own start month (mandate/calendar.ts's MANDATE_START_MONTH)

/**
 * ⚠️ M6.1 §1-7: THE FRANCE 2027 BASELINE — replaces the M0-M6 placeholder
 * dataset. Full sourcing, derivation, and provenance status for every
 * figure below is documented in `docs/FRANCE_BASELINE_2027.md`; this file
 * only carries a condensed version of that derivation. Two layers:
 *
 * 1. OBSERVED 2025 ANCHOR (Insee, French public accounts 2025, published
 *    May/August 2026): nominal GDP €2,991bn; public revenue 52.2% GDP;
 *    public expenditure 57.3% GDP (€1,714.1bn); deficit €152.5bn (5.1%
 *    GDP); debt €3,460.5bn (115.7% GDP); interest expenditure €64.7bn.
 * 2. 2027 GAME START (FORECAST/GAME_ESTIMATE, derived — never labeled
 *    OBSERVED): the mandate begins May 2027, so the 2025 anchor is
 *    bridged forward 2 years using Banque de France's June 2026
 *    projection (real growth ~0.9%, HICP inflation ~1.7%, unemployment
 *    ~8.1% for 2027; "only limited deficit improvement" from 2026's
 *    ~-5.2%; debt "continues rising toward ~122% GDP in 2028").
 *
 * DERIVATION (all a documented, simplified bridge — not a second economic
 * model):
 * - Nominal growth 2026-2027 ≈ real 0.9% + inflation 1.7% = 2.6%/year,
 *   applied as a flat 2-year assumption (no separate 2026 macro figure was
 *   given, so the 2027 rate is used for both bridge years — documented
 *   simplification).
 *   nominalGdp = 2,991 × 1.026² ≈ 3,149 → rounded to 3,150 Md€.
 * - Debt ratio interpolated between the 2025 observed 115.7% and the
 *   "~122% by 2028" trajectory ≈ 120.0% for 2027 (a smooth ~2pp/year
 *   glide path) → debt = 3,150 × 1.20 = 3,780 Md€.
 * - Deficit ratio: "only limited improvement" from 2026's ~-5.2% → 5.0%
 *   for 2027 (a modest, explicitly documented assumption, not a computed
 *   figure) → deficit = 3,150 × 5.0% = 157.5 → rounded to 158 Md€.
 * - Revenue/expenditure split: the 2025 observed revenue ratio (52.2%
 *   GDP) is held roughly flat (52.0%, no major legislated shift assumed);
 *   the expenditure ratio is then whatever satisfies the 5.0% deficit
 *   target (57.0%) — never invented independently of the deficit.
 *   publicRevenue = 3,150 × 52.0% = 1,638 Md€.
 *   publicSpending = 3,150 × 57.0% = 1,795.5 → rounded to 1,796 Md€
 *   (reconciles: 1,796 − 1,638 = 158 ✓).
 * - Interest cost: NOT simply "3% × gross Maastricht debt" (M6.1 §6's
 *   explicit warning) — the 2025 OBSERVED effective rate is
 *   64.7 / 3,460.5 ≈ 1.87%, computed against the SAME Maastricht debt
 *   concept `debt`/`debtRatio` already track, so this ratio is the
 *   correct like-for-like anchor (not a mismatched accounting-vs-Maastricht
 *   comparison). A modest further uptick to ≈2.0% by 2027 is assumed —
 *   consistent with continued gradual refinancing at higher rates as
 *   older, cheaper debt matures and rolls over (the SAME gradual
 *   mechanism `engine/economy/debt.ts`'s `computeEffectiveDebtRate`
 *   already implements turn to turn — this is only its DOCUMENTED
 *   starting value, not a new mechanism).
 *   interestCost = 3,780 × 2.0% ≈ 75.6 → rounded to 76 Md€.
 *
 * Every figure below reconciles exactly (see
 * `data/initialState.test.ts`'s identity tests):
 * publicRevenue/nominalGdp ≈ 52.0%, publicSpending/nominalGdp ≈ 57.0%,
 * (publicSpending−publicRevenue)/nominalGdp ≈ deficitRatio,
 * debt/nominalGdp ≈ debtRatio, interestCost ≈ effectiveDebtRate% × debt.
 */
const FRANCE_2027_ECONOMIC_STATE = {
  gdp: 3150, // Md€, FORECAST/GAME_ESTIMATE — derived from the 2025 OBSERVED Insee anchor (€2,991bn), see module doc
  nominalGdp: 3150, // Md€ — equal to real GDP at t=0 (index base)
  potentialGrowth: 0.9, // %/year, FORECAST — Banque de France June 2026 projection for 2027
  growth: 0.9, // %/year — starts at potential (no cyclical gap)
  inflation: 1.7, // %/year, FORECAST — Banque de France June 2026 projection for 2027 (HICP)

  unemployment: 8.1, // %, FORECAST — Banque de France June 2026 projection for 2027
  structuralUnemployment: 8.1, // %, — starts equal to unemployment (no cyclical gap)

  publicRevenue: 1638, // Md€/year run-rate, FORECAST/GAME_ESTIMATE — 52.0% of nominalGdp, see module doc derivation
  publicSpending: 1796, // Md€/year run-rate, FORECAST/GAME_ESTIMATE — 57.0% of nominalGdp (includes interestCost below)
  fiscalBalance: -158, // Md€/year (publicRevenue - publicSpending)
  deficit: 158, // Md€/year (max(0, -fiscalBalance))
  deficitRatio: 5.0, // % of nominal GDP, FORECAST/GAME_ESTIMATE — see module doc ("limited improvement" from the 2026 baseline)

  debt: 3780, // Md€, FORECAST/GAME_ESTIMATE — 120.0% of nominalGdp, interpolated between the 2025 observed 115.7% and ~122% by 2028
  debtRatio: 120.0, // % of nominal GDP

  effectiveDebtRate: 2.0, // %/year blended rate on the debt stock, FORECAST/GAME_ESTIMATE — see module doc (2025 observed effective rate ≈1.87%, gradual uptick assumed)
  interestCost: 76, // Md€/year, FORECAST/GAME_ESTIMATE (effectiveDebtRate% × debt)

  purchasingPower: 0, // cumulative index, 0 = baseline at game start, GAME_ESTIMATE

  productivityGrowth: 0.83, // %/year, GAME_ESTIMATE — chosen so labor + productivity*passthrough ≈ potentialGrowth at turn 1 (an M1.5 engine-calibration detail, independent of the fiscal rebaseline)

  consumerConfidence: 50, // index 0-100, GAME_ESTIMATE (neutral)
  businessConfidence: 50, // index 0-100, GAME_ESTIMATE (neutral)
  marketConfidence: 50, // index 0-100, GAME_ESTIMATE (neutral)

  publicSectorEfficiency: 55, // index 0-100, GAME_ESTIMATE
} satisfies GameState['economic']

const FRANCE_2027_POLITICAL_STATE = {
  popularity: 52, // %, GAME_ESTIMATE — matches the M2 vertical-slice content spec (post-election popularity)
  parliamentSeats: 289, // seats held by the governing coalition, GAME_ESTIMATE
  politicalCredibility: 60, // index 0-100, GAME_ESTIMATE
} satisfies GameState['political']

const FRANCE_2027_SOCIAL_STATE = {
  socialTension: 30, // index 0-100, GAME_ESTIMATE
} satisfies GameState['social']

/** Builds a fresh GameState for a new Country Run playthrough — the France 2027 baseline (see module doc and docs/FRANCE_BASELINE_2027.md). */
export function createInitialGameState(seed: Seed): GameState {
  return {
    meta: {
      seed,
      turn: 0,
      year: GAME_START_YEAR,
      month: GAME_START_MONTH,
      phase: 'setup',
    },
    economic: { ...FRANCE_2027_ECONOMIC_STATE },
    political: { ...FRANCE_2027_POLITICAL_STATE },
    social: { ...FRANCE_2027_SOCIAL_STATE },
    policy: { activePolicies: [] },
    delayedEffects: [],
  }
}
