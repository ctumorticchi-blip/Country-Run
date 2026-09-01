# Gameplay — M3 (Campaign, Promises & Government)

M3 adds the pre-presidency layer in front of the M2 Year 1 vertical slice:
a campaign where the player picks 5 promises, a deterministic (always-won)
election, a France briefing, a government profile choice, a deterministic
legislative election, and a Parliament composition reveal — all before
handing off into the existing, unmodified M2 gameplay (Bercy audit → energy
shock → Budget Builder → Parliament vote → Year 1 report). This document
explains what M3 added; it does not re-explain the M1.5 engine
(`docs/ECONOMIC_ENGINE.md`) or the M2 Year 1 loop (`docs/GAMEPLAY_M2.md`),
both of which are unchanged.

## Scope and non-goals

M3 is architecture for the full 5-year mandate, not another 3-minute demo —
but it still only *plays* through Year 1 (the M2 slice). Years 2-5, a real
promise-deadline resolution loop past turn 6, and deep `politicalCapital`
spending mechanics are explicitly out of scope; see "Known limitations"
below and each module's own header comment for what's deliberately
deferred.

## Screen flow

```
landing → campaignIntro → promiseSelection → promiseConfirmation → election
   → franceBriefing → governmentSelection → legislativeElection
   → parliamentComposition → mandateStart
   → bercyAudit → energyShock → budgetBuilder → parliamentVote → yearReport
                                                                       │
                                             ┌─────────────────────────┴───────────────┐
                                             ▼                                          ▼
                               REJOUER L'ANNÉE (same seed + same                NOUVELLE PARTIE (new seed,
                               campaign choices → back to bercyAudit)           → back to landing)
```

`'parliament'` (M2's ScreenId) was renamed `'parliamentVote'` to
disambiguate it from the new `'parliamentComposition'` screen — the Year 1
budget vote itself is otherwise unchanged (`prototype/parliament.ts`).

## New modules

| Module | Responsibility |
| --- | --- |
| `game/country-run/promises/promiseTypes.ts` | `PromiseDefinition`, `PromiseStatus`, `PoliticalTag` shapes |
| `game/country-run/promises/promiseCatalog.ts` | The 15 static promises (content-as-code, like `budgetCategories.ts`) |
| `game/country-run/promises/promiseEvaluators.ts` | 3 reusable evaluator shapes (`evaluateThreshold`, `evaluatePolicyCommitment`, `evaluateUnavailableLever`) |
| `game/country-run/promises/promiseSelection.ts` | Selection validity, fiscal cost aggregation, tag coherence — shared by the election score, Parliament seat bonus and the Bercy warning |
| `game/country-run/government/governmentTypes.ts` / `governmentProfiles.ts` | The 4 fictional government profiles and their 7-dimension modifiers |
| `game/country-run/government/governmentEffects.ts` | The 7 controlled integration points a modifier is allowed to touch |
| `game/country-run/prototype/electionResult.ts` | Bounded [50.5, 54.0] election score + descriptive profile label |
| `game/country-run/prototype/parliamentComposition.ts` | Deterministic 577-seat legislative election (fictional blocs) |
| `game/country-run/prototype/politicalCapital.ts` | One-time [0, 100] capital computation (architecture only) |
| `game/country-run/prototype/policyHistory.ts` | Append-only log of meaningful decisions, read by promise evaluators |
| `game/country-run/prototype/franceBriefingContent.ts` | Indicator explanations + provenance tags for the briefing screen |

## The 15 promises

Exactly 5 must be selected (`promiseSelection.ts`'s `REQUIRED_PROMISE_COUNT`).
No ideology is ever asked — categories are Product-Bible-neutral labels
(`purchasingPower`, `health`, `taxation`, ...), never left/right.

| id | category | deadline | est. cost (Md€/an) |
| --- | --- | --- | --- |
| `reduce-deficit` | publicFinances | Year 3 | 0 |
| `reduce-unemployment` | employment | mandate end | 0 |
| `increase-purchasing-power` | purchasingPower | mandate end | 0 |
| `hospital-plan` | health | Year 2 | 10 |
| `invest-education` | education | Year 2 | 8 |
| `grand-investment-plan` | investment | Year 2 | 15 |
| `reduce-debt` | publicFinances | mandate end | 0 |
| `cut-household-taxes` | taxation | mandate end | 8 |
| `cut-business-taxes` | taxation | mandate end | 6 |
| `strengthen-defense` | security | Year 2 | 10 |
| `energy-transition` | environment | Year 3 | 8 |
| `build-housing` | housing | Year 3 | 8 |
| `no-tax-increase` | taxation | mandate end | 0 |
| `protect-pensions` | pensions | mandate end | 0 |
| `restore-public-services` | publicServices | Year 3 | 0 |

### Deadlines and "playing only Year 1"

Deadlines are in turns (6/year): Year 1 = 6, Year 2 = 12, Year 3 = 18,
mandate end = 30. M3 only simulates Year 1 (turn 6), so most promises can
only ever show a trajectory status (`ON_TRACK`/`AT_RISK`) this milestone —
`KEPT`/`BROKEN` only fire once `currentTurn >= deadlineTurn`, which
naturally starts happening for the Year-1-deadline promises and will keep
happening for the later ones once a future milestone plays past turn 6.

### Temporary evaluators — 7 promises, honestly

M3's Year 1 gameplay (Bercy, energy, the 4-category Budget Builder) has no
dedicated lever for taxes, pensions, energy transition, or housing. Rather
than fabricating fake levers (scope creep) or silently resolving these to a
made-up KEPT/BROKEN, each is marked `temporaryEvaluator: true`:

- `energy-transition`, `build-housing` piggyback on the public investment
  budget category (the closest existing lever).
- `restore-public-services` uses a composite health+education proxy.
- `cut-household-taxes`, `cut-business-taxes`, `no-tax-increase`,
  `protect-pensions` have **no** lever at all yet — their evaluator
  (`evaluateUnavailableLever`) always returns `IN_PROGRESS` with an honest
  French explanation, never fakes a resolution.

### Promise progress is never stored — only `selectedPromiseIds` is

The brief asks for both "add `promiseProgress` to game state" and "derived
values should remain derived." These are reconciled by NOT storing
progress/status: `GamePrototypeState` only persists the 5 chosen
`selectedPromiseIds`. Status is always recomputed on demand by calling each
promise's own `evaluate(ctx)` closure against the current
`{ initialEconomic, currentEconomic, currentTurn, policyHistory }` — see
`app/components/PromiseTracker.tsx`, rendered on every gameplay screen from
mandate start onward. This also means status can never drift from what the
player actually did.

### Promises don't auto-execute — "No Free Lunch"

Selecting a promise never injects its own effects into the simulation.
Nothing stops a fiscally contradictory 5-promise programme from being
selected (`promiseSelection.ts` has no validation beyond "exactly 5,
unique") — `promiseConfirmation` and the Bercy audit both show a
"⚠️ PROGRAMME DIFFICILE À FINANCER" warning above `FISCAL_WARNING_THRESHOLD_BN`
(25 Md€/an), but the player can proceed regardless. A promise only reaches
`KEPT` if the player's ACTUAL Year 1 decisions (logged to `policyHistory`)
deliver it.

## Government profiles

4 fictional profiles (`governmentProfiles.ts`), each a genuine trade-off —
every modifier is in [0.90, 1.10], every profile has at least one dimension
≥1.05 and one ≤0.95, and no profile is ≥ another on all 7 dimensions
(verified in `governmentProfiles.test.ts`):

| Profile | Strong | Weak |
| --- | --- | --- |
| Les Experts | fiscalForecastAccuracy 1.10, economicExecution 1.08, marketCredibility 1.08 | parliamentNegotiation 0.90, popularityResilience 0.92 |
| Les Politiques | parliamentNegotiation 1.10, popularityResilience 1.08 | fiscalForecastAccuracy 0.92, economicExecution 0.95 |
| Le Gouvernement d'Union | parliamentNegotiation 1.08, popularityResilience 1.05 | reformEffectiveness 0.90, implementationSpeed 0.92 |
| Les Réformateurs | reformEffectiveness 1.10, implementationSpeed 1.08 | popularityResilience 0.90, parliamentNegotiation 0.92 |

### The 7 controlled integration points (`governmentEffects.ts`)

Per the brief's explicit constraint, modifiers never mutate
`DEFAULT_ECONOMIC_ENGINE_CONFIG` or any other shared engine object — every
function below is pure and returns a new value:

1. `economicExecution` → `applyExecutionScaling` scales the enacted
   fiscal/investment policy fields before they reach the engine.
2. `reformEffectiveness` → `applyExecutionScaling` scales the 2 reform
   intensity fields specifically (not the fiscal fields).
3. `parliamentNegotiation` → `scaleParliamentPassProbability`, bounded to
   [0.05, 0.98] so the vote is never fully certain either way.
4. `popularityResilience` → `applyPopularityResilience` dampens negative
   popularity deltas only; gains are never amplified.
5. `marketCredibility` → `governmentMarketConfidenceNudge`, a one-time
   ±5pt `marketConfidence` nudge applied once at government selection.
6. `fiscalForecastAccuracy` → `fiscalEstimateRangeWidth`, a UI-only range
   width (never touches the simulation).
7. `implementationSpeed` → `deriveGovernmentEngineConfig` returns a cloned
   `EconomicEngineConfig` with delayed-effect horizons scaled — passed into
   `simulateYearOne` for that playthrough only.

## Legislative election & Parliament composition

`parliamentComposition.ts` generates a full, entirely fictional 577-seat
Assembly (`TOTAL_SEATS`, reused from `prototype/parliament.ts`) — no real
French party is named. The player's own coalition ("Majorité
Présidentielle") is sized from the election score, promise-tag coherence,
and the government's `parliamentNegotiation` modifier, clamped to
[`PLAYER_SEATS_MIN` 220, `PLAYER_SEATS_MAX` 300]. The remainder is split
across 4 fictional opposition blocs plus a small "Non-Inscrits" bloc,
weighted by whether each bloc's affinity tags overlap the player's dominant
promise tags — so a different 5-promise selection can shift which
opposition blocs gain or lose seats. Everything is deterministic
(`createActionRng(seed, 'legislative-election')`) and always totals exactly
577 (`parliamentComposition.test.ts`). Outcomes are classified
`MAJORITÉ_ABSOLUE` (≥289), `MAJORITÉ_RELATIVE` (≥240), or `ASSEMBLÉE_FRAGMENTÉE`.

This is distinct from `prototype/parliament.ts`'s single seeded coin-flip
Budget vote (unchanged from M2) — the Year 1 `parliamentVote` screen now
shows the player's REAL seat count from the legislative election instead of
M2's fixed 263-seat placeholder.

## Political capital

`politicalCapital.ts` computes a single [0, 100] value once, at
`CHOOSE_GOVERNMENT`, from the election score, majority outcome, and promise
coherence. Per the brief, this is architecture only — it's stored and
displayed (`MandateStartScreen`) but nothing spends or replenishes it
during M3's gameplay yet.

## Save-readiness

`GamePrototypeState` gained `gameVersion`, `seed` (already existed),
`createdAt`, `updatedAt`. No cloud saves exist, but the whole state is a
plain, JSON-serializable object (no class instances) —
`gameReducer.test.ts`'s "serializable state" tests round-trip the full
state through `JSON.stringify`/`JSON.parse`. `createdAt`/`updatedAt` are
set once at state construction (`freshRunState`) via the same
one-off-non-determinism pattern as seed generation — never touched inside
the reducer's action handlers, so the reducer stays pure under
`<StrictMode>`'s double-invoke.

## Known limitations

- Only Year 1 is playable; Years 2-5 and true promise-deadline resolution
  past turn 6 don't exist yet.
- 7 of the 15 promises use a documented temporary evaluator (see above) —
  the underlying gameplay levers (taxes, pensions, a dedicated energy/
  housing budget line) don't exist yet.
- `politicalCapital` is computed and displayed but not yet spent on
  anything.
- Provenance tags on the France Briefing only use `GAME_ESTIMATE` and
  `FORECAST` — `OBSERVED` exists in the type for when a real, sourced
  dataset replaces `data/initialState.ts`'s documented fictional
  placeholder (Product Bible §19); using it now would mislabel a made-up
  number as real data.
