# The Mandate — M5 (Full 5-Year, 30-Turn Game)

M5 turns Country Run from a one-year vertical slice (M2-M4) into a complete
playable 5-year mandate: a canonical May 2027 → May 2032 calendar, 30 turns
played one at a time under explicit player confirmation, ~12 deterministic
random events, 5 annual budget cycles that persist as absolute policy
levels (not deltas), up to 5 discretionary reforms, promise deadlines that
freeze permanently, a mandate-wide popularity/tension model, local
save/resume, and a final 5-year score and record. This document explains
what M5 added; it does not re-explain the M1.5 engine
(`docs/ECONOMIC_ENGINE.md`) or the M2-M4 layers (`docs/GAMEPLAY_M2.md`,
`docs/GAMEPLAY_M3.md`, `docs/PARLIAMENT_M4.md`), which are otherwise
unchanged and fully reused — M5 did not redesign the economic engine, did
not rebuild Parliament, and did not throw away the M3/M4 campaign/
promises/government/bill flow. It repeats that flow 5 times and wraps it
in a per-turn loop.

## New modules

| Module | Responsibility |
| --- | --- |
| `mandate/calendar.ts` | The single source of truth for "what date is turn N" |
| `mandate/turnController.ts` | Pure, composable per-turn orchestration: economic step, due implementations, event roll, event-choice application, year-end drift |
| `mandate/popularityV2.ts` | Mandate-wide, bounded, multi-input popularity model |
| `mandate/governmentTensionV2.ts` | The other tension sources M4 didn't wire up (votes, broken deals, compromises, popularity drift) |
| `mandate/economicSnapshots.ts` | Compact per-turn indicator history (30-max) |
| `mandate/economicSentiment.ts` | Recent-trend-weighted popularity input ("falling fast beats rising slowly") |
| `mandate/economicExplanation.ts` | "CE QUI A CHANGÉ" — a ranked, heuristic driver breakdown from the engine's own diagnostics |
| `mandate/finalScoring.ts` | The new 7-category score + 9 ending titles |
| `promises/promiseResolution.ts` | Freezes a promise's final KEPT/PARTIAL/BROKEN status at its deadline |
| `events/eventTypes.ts`, `eventCatalog.ts`, `eventSelection.ts` | The event system: types, 13 definitions (12 conceptual events), deterministic selection |
| `budget/budgetCategories.ts`, `budgetTypes.ts`, `budgetEffects.ts` | Rewritten for 7 categories and persistent absolute levels (was 4 categories / per-year enum) |
| `parliament/implementationSchedule.ts` | The generic "adopted now, effective N turns later" queue, shared by bill and event delayed effects |
| `app/save.ts` | localStorage save/resume, version-gated, no migrations |

## The calendar (`mandate/calendar.ts`)

`MANDATE_TURNS = 30` (`TURNS_PER_YEAR` × `MANDATE_YEARS`, both already
existed pre-M5). Turn 1 = May-Jun 2027; turn 30 = Mar-Apr 2032; "mandate
conclusion" (May 2032) is the moment AFTER turn 30, never itself a turn.
`turnToDate(turn)` is the only function anywhere in the codebase that maps
a turn number to a calendar month/year — no screen or component hardcodes
a date. A "gameplay year" is a strict 6-turn block (`turnToGameplayYear`,
`isYearStartTurn`/`isYearEndTurn`) starting at turn 1, **not** aligned to
the calendar year — the brief's loose "Year 1: May-Dec 2027..." narrative
is flavor/event-weighting guidance, not a literal calendar-year boundary;
the exact turn-to-date table is the actual contract, verified turn-by-turn
in `calendar.test.ts`. `MIDTERM_TURN = 18` (end of Year 3) and
`MANDATE_END_TURN = 30` are the two special review triggers.

## The turn controller (`mandate/turnController.ts`)

A set of small, independently-tested PURE functions — not one big
"do everything" call — because an event's player-chosen effects genuinely
can't be known until AFTER the EVENT screen, which is a separate dispatch
from the turn that rolled it:

- **`beginMandateTurn`** — the deterministic part of one turn: folds any
  `ScheduledImplementation` whose `scheduledTurn` is now due into
  `implementedReformPolicies`, re-derives the merged policy, runs exactly
  one turn of the real M1.5 engine (`advanceEconomicTurn`), and rolls for
  at most one event (`eventSelection.ts`).
- **`applyEventChoice`** / **`applyEventWorldEffect`** — once the player
  picks a choice, fold its `economicPolicyEffect` (immediate, felt from
  next turn) and `delayedEffects` (scheduled via the SAME
  `ScheduledImplementation` queue bills use) into mandate state, and apply
  its one-off `worldEffect` nudge to `WorldState`.
- **`popularityDeltaFromNewPromiseResolutions`** — bridges a just-frozen
  promise resolution into a popularity delta.
- **`turnTransitionFlags`** — one bundled read of
  isYearStart/isYearEnd/isMidterm/isMandateEnd for a turn.
- **`applyYearEndDrift`** — the once-per-year political-capital and
  government-tension nudge.

`gameReducer.ts`'s `ADVANCE_TURN` handler calls these in sequence and owns
the STATEFUL wiring (screen transitions, storing results back into
`GamePrototypeState`) — `turnController.ts` itself never touches React
state and has zero knowledge of screens.

### Avoiding the M1.5 bug across 30 turns and 5 budget cycles

Rather than one running `activePolicyInput` accumulator, mandate state
stores SEPARATE named contributions — `bercyPolicyEffect` (fixed once),
`budgetLevels` (persistent absolute, replaced wholesale each cycle),
`implementedReformPolicies` (accumulates permanently, one bill/event
effect at a time) — always freshly re-merged via `mergeMandatePolicy`
rather than incrementally added to. This alone is not sufficient, though:
`beginMandateTurn` also needs to know what was ACTUALLY fed to the engine
on the PRECEDING turn to compute a correct delta, and that value can jump
discontinuously the instant a budget bill is adopted. `GamePrototypeState`
therefore also stores `lastMergedPolicyInput` — threaded turn to turn, and
explicitly NOT re-derived from current committed state — because
re-deriving it would make a just-adopted budget invisible to
`computePolicyDelta` on exactly the turn it should first be felt (turnController.test.ts's "a budget CHANGE between two turns... IS felt as a fresh delta" test guards this directly; this was in fact caught as a real regression during M5 development and is the reason this field exists rather than being a purely defensive design choice).

## The annual cycle

Each gameplay year follows the same shape, repeated 5 times:

```
(Year 1 only) CHOOSE_BERCY
BUDGET_PREPARATION  (budgetBuilder)      — draft tiers for all 7 categories
BUDGET_NEGOTIATION  (billNegotiation)    — the mandatory Budget Bill, M4 pipeline
BUDGET_VOTE         (billVote)           — resolved; levels commit on ADOPTED
REFORM_HUB          (reformHub)          — optional, at most one discretionary bill
  → its own NEGOTIATION/VOTE if chosen, same M4 pipeline
MANDATE_TURN × 6    (mandateTurn/event)  — the per-turn loop, calendar advances
                                            only on explicit ADVANCE_TURN
YEAR_REVIEW         (yearReview)         — BILAN ANNÉE X, provisional score
                                            (+ MI-MANDAT banner at turn 18)
```

At turn 30 the year loop's last `YEAR_REVIEW` is replaced by
`MANDATE_REVIEW` ("5 ANS PLUS TARD") instead of continuing to a 6th
budget cycle.

## Events (`events/`)

`EventDefinition` (id, title, category, description, `earliestTurn`/
`latestTurn`, `baseProbability`, optional `conditions`/`probabilityModifier`/
`exclusiveGroup`/`cooldown`, `choices`, optional `worldShock`, `tags`).
`EventChoice` carries `fiscalEffect` (display), `economicPolicyEffect`
(immediate, permanent), `worldEffect` (one-off `WorldState` nudge, distinct
from the event's own `worldShock`), `popularityEffect`/
`politicalCapitalEffect`/`governmentTensionEffect`/
`blocRelationshipEffects`, `delayedEffects`, and a mandatory
`immediateFeedback` string (never invented narrative — always a plain-
language echo of the effects actually applied).

**Selection** (`eventSelection.ts`) is fully deterministic: every event is
first filtered by turn window / one-shot-already-fired / `exclusiveGroup`
(at most one member of a group ever fires per run) / `conditions`, then a
SINGLE RNG roll per turn (never one roll per candidate — that would make
the real fire rate depend on how many events happen to be eligible)
walks the eligible list in a fixed, seed-independent order (sorted by id)
accumulating probability mass. At most one event fires per turn.

**The 13 catalog entries** (12 conceptual events — `tax-windfall`/
`tax-shortfall` are the two condition-gated, mutually-exclusive variants of
one "tax revenue surprise"): Energy Shock (migrated from M2's fixed
pre-mandate decision, not duplicated — kept a high `baseProbability` over
turns 1-12 so it still very likely fires early, preserving the established
onboarding feel), Hospital Strike, Industrial Plant Closure, European
Slowdown, Drought/Climate Shock, Housing Crisis, Public Debt Warning,
Social Protest, Technology/Productivity Opportunity, Defense/International
Pressure, Tax Revenue Surprise (×2), Political Crisis. Every fiscal/
political number is a gameplay-design choice, not sourced — same caveat as
every other prototype content module since M2. `political-crisis` is
gated behind real `governmentTension`/`politicalCapital` conditions and
its own `probabilityModifier`, closing the loop the brief asked for
("high tension raises political-crisis probability").

## Budget cycles (`budget/`)

Expanded from 4 categories to 7 (Health, Education, Public Investment,
Defense, Housing & Territories, Green Transition, Administration
Efficiency) — game-control ENVELOPES, not exhaustive COFOG accounting.
Pensions/taxes stay reforms rather than budget categories (no dedicated
architecture exists for them as a recurring budget line). Each category
has 3-4 tiers, each an ANNUALIZED ABSOLUTE LEVEL (Md€/year vs. a true zero
baseline) — `BudgetLevels` is the PERSISTENT state (carried across all 5
cycles); `BudgetSelections` is only the in-progress tier-id draft, reset
from `selectionsFromLevels(budgetLevels)` at the start of each cycle.

`budgetLevelsToPolicyInput` always returns the FULL absolute contribution
— never a delta. The engine's own `computePolicyDelta` (M1.5, unchanged)
is entirely responsible for turning two consecutive absolute totals into
the correct marginal delta: a category kept at the same level year over
year produces a genuine zero delta with no bespoke Country Run code
needed to enforce it. **This is a deliberate simplification from M2-M4's
one-shot model, not an oversight**: a rejected annual budget bill now
leaves `budgetLevels` UNCHANGED (last year's levels persist) rather than
applying M2's scaled-down compromise policy — "nothing changed" is now a
fully valid, zero-delta outcome the engine already supports natively,
so the compromise-scaling mechanism (`COMPROMISE_SCALE_ON_REJECTION`) is
no longer used for the recurring annual budget (a rejected DISCRETIONARY
reform still simply contributes nothing, as in M4).

Every annual budget goes through the full M4 negotiation/vote pipeline —
no shortcuts after Year 1 — and bloc relationships/political deals persist
and carry forward across all 5 cycles, exactly as they do within a single
M4 negotiation.

## Reforms (`parliament/bills.ts`)

Expanded from 4 to 12: Hospital Plan, Education Investment, Business Tax
Cut, Energy Transition, Household Tax Cut, Housing Construction Plan,
Pension Reform, Labor Market Reform, Public Administration Reform, Defense
Expansion, Industry/Innovation Plan, Public Investment Plan. At most ONE
discretionary reform per gameplay year (enforced structurally — Reform Hub
is only ever reached once per year, right after that year's budget bill
resolves), and a bill already ADOPTED once can never be re-proposed
(`availableReformBills` filters it out for every subsequent year). Not
every reform is beneficial: several (Pension Reform, Public Administration
Reform) trade a real fiscal saving or structural benefit for high
controversy and a real chance of provoking a Social Protest event.

**Implementation scheduling, actually fixed (M5 §38 fixes an M4
limitation)**: `implementationDelay` existed in M4 but was never scheduled
— every M4 bill's effect landed immediately. M5's
`parliament/implementationSchedule.ts` (`ScheduledImplementation`,
`dueImplementations`/`pendingImplementations`) is a generic queue,
deliberately reused for BOTH bill adoption and an event choice's
`delayedEffects` (the field names — `sourceId`/`label`, not `billId`/
`billTitle` — were chosen for this dual purpose). The Budget Bill's own
`implementationDelay` stays 0 (folds directly into `budgetLevels`, felt
the very next turn); every reform bill has `implementationDelay >= 1` and
is applied via the schedule, exactly once, on the turn it matures
(verified in `implementationSchedule.test.ts` and
`turnController.test.ts`).

## Promises — deadline resolution (`promises/promiseResolution.ts`)

M3's runtime `evaluate()` read (`NOT_STARTED`/`IN_PROGRESS`/`ON_TRACK`/
`AT_RISK`/`KEPT`/`BROKEN`) is a LIVE, always-derived read that keeps
working exactly as before, right up until a promise's `deadlineTurn` is
reached. From that turn on, its status is FROZEN into a stored
`PromiseResolution` (`promiseId`, `finalStatus`, `resolvedTurn`,
`progressLabel`) — a three-way KEPT/PARTIAL/BROKEN classification distinct
from the 6-state runtime one, since a near-miss now reads PARTIAL rather
than a hard BROKEN (via each evaluator's own `progressFraction`, ≥ 0.5 of
the way to target counts as partial credit; a `temporaryEvaluator`
promise — one with no real lever yet — always resolves PARTIAL, never a
false KEPT or an unfairly hard BROKEN). This is the ONE piece of state
that genuinely cannot be re-derived: re-evaluating a threshold promise
against LATER economic state after its own deadline has passed would let
its status oscillate turn to turn, which is exactly what freezing exists
to prevent. Every selected promise is guaranteed a deadline turn within
the 30-turn mandate, so every promise is always resolved by mandate end —
closing the door on any "avoid the deadline" scoring exploit by
construction.

## Popularity V2 (`mandate/popularityV2.ts`)

Per-turn deltas are combined from several SMALL, individually-capped
sources (`computePopularityTurnDelta`): recent economic trend
(`economicSentiment.ts` — recency-weighted, so a bad-but-improving economy
reads positive and a good-but-worsening one reads negative, independent of
the raw level: "8% falling quickly is perceived better than 7.5% rising"),
newly-frozen promise resolutions, a resolved bill's own outcome. A quiet
turn with none of these lands close to the brief's ±2; only a bill vote or
a real event choice can move it further. Every raw delta still passes
through the existing government `popularityResilience` modifier before
being applied — unchanged M3 integration point.

## Government tension V2 (`mandate/governmentTensionV2.ts`)

M4 only ever moved `governmentTension` via the exceptional procedure; M5
adds the rest without touching that: `tensionDeltaFromVoteOutcome` (a pass
relieves it a little, more for a hard-fought win; a defeat raises it more
for a more controversial — "major" — bill), `tensionDeltaFromBrokenDeals`
(a `PoliticalDeal` struck for the just-resolved bill whose bloc still
voted against — a real breach, not just a lost vote),
`tensionDeltaFromCompromise` (concessions that actually secured a pass
read as a genuine compromise, a bit more relief than a clean win),
`tensionDeltaFromPopularity` (a small year-end drift). High tension raises
the `political-crisis` event's own `probabilityModifier`. No automatic
government-collapse mechanic exists yet at any tension level — same
explicit deferral M4 already documented; "reshuffle" as a tension-relief
lever is a documented placeholder with no mechanic behind it yet.

## Final scoring (`mandate/finalScoring.ts`)

New weights: Economy 25%, Public Finances 20%, Purchasing Power 15%,
Employment 10% (split out of M2's combined "economy" category), Promises
15%, Political Stability 10% (popularity + tension + political capital,
combined), Public Investment/Services 5%. Catastrophic-threshold penalties
(recalibrated for 5-year deltas, not a simple multiple of M2's 1-year
ones) apply a multiplicative penalty for a severe debt+deficit blowout, a
mandate-end recession, a large sustained unemployment rise, or extreme
government tension — so no single strong metric can fully mask a genuine
5-year catastrophe elsewhere. `computeFinalScore` is called at EVERY
`YEAR_REVIEW` (a genuine "NOTE DE MANDAT PROVISOIRE" — the mandate isn't
over) and again, unchanged in shape, at `MANDATE_REVIEW` (the true final
score) — same function, just invoked at a different point in time; there
is no separate "final-only" scoring path. 9 descriptive, non-ideological
ending titles (`LA TEMPÊTE DU QUINQUENNAT`, `LE BÂTISSEUR`,
`LE RÉFORMATEUR`, `LE PARI RISQUÉ`, `LE PRÉSIDENT DES PROMESSES TENUES`,
`LE TECHNOCRATE`, `LE POPULAIRE FRAGILE`, `LE GESTIONNAIRE PRUDENT`,
`LE GESTIONNAIRE`), rule-based in priority order, describing the SHAPE of
the mandate — never a left/right judgment.

## Save / resume (`app/save.ts`)

`GamePrototypeState` is already fully JSON-serializable (M3/M4's own
round-trip tests already proved this); the save module is intentionally
thin — `JSON.stringify`/`JSON.parse` gated by `GAME_VERSION`, no custom
serializer, no migration logic. An incompatible or corrupt save fails
safely to `null`; the caller (`App.tsx`) always falls back to a brand-new
game. The landing screen offers REPRENDRE LA PARTIE only when a save with
real progress exists (`screen !== 'landing'`); NOUVELLE PARTIE always
starts fresh. Saved after every resolved turn/decision (a `useEffect` on
every state change) — cheap and idempotent, so over-saving is harmless.

**Save/reload never alters the RNG sequence** — every random draw in this
codebase is derived fresh via `createActionRng(seed, label)`, where
`label` is built entirely from state already present in
`GamePrototypeState` (the current turn, a bill id, an attempt number...).
Reloading and continuing therefore reproduces EXACTLY the draws a
continuous run would have made — the RNG has no notion of "how many times
the page was loaded". `save.test.ts` proves this directly: a continuous
run and a save/reload-midway run with identical subsequent actions produce
byte-identical final states (timestamps aside).

## Navigation & detail views

A compact, persistent `NavBar` (ÉLYSÉE dashboard is the default
`mandateTurn`/budget/event screen itself; ÉCONOMIE/PROMESSES/ASSEMBLÉE/
HISTORIQUE are read-only overlays via `DetailPanel`) is shown on every
mandate-loop screen. Every in-game ACTION stays contextual to its own
screen — the nav never itself advances the simulation, only toggles which
read-only view is on top.

## Known placeholders / limitations

- No reelection campaign exists yet — `MANDATE_REVIEW` is a genuine
  terminal screen (NOUVELLE PARTIE only), as the brief explicitly asked
  for this milestone.
- No government-collapse/confidence-vote mechanic — `governmentTension`
  only feeds one event's probability, same explicit deferral M4 already
  documented for this milestone.
- "Reshuffle" (remaniement) as a tension-relief lever is named in
  `governmentTensionV2.ts`'s doc comment but has no mechanic behind it.
- The Economy/Assembly/History detail views are compact and reuse simple
  CSS (seats bar, indicator grid, a chronological list) — no charting
  library, per the brief; small SVG/CSS trend lines were judged unneeded
  given the indicator grid already covers the same information legibly.
- Every fiscal/political number across the event catalog, reform catalog,
  budget tiers, popularity/tension coefficients, and scoring weights is a
  gameplay-design choice, not sourced — the same caveat every prototype
  content module has carried since M2's `PLACEHOLDER_ECONOMIC_STATE`.
- `RESUME_SAVED_GAME` hands the loaded save back to the reducer verbatim
  with no shape migration; a save from an earlier `GAME_VERSION` is
  discarded outright rather than partially repaired, per the brief's "no
  complex migrations" instruction.
