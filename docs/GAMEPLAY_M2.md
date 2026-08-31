# Gameplay — M2 (Budget Builder + First Playable Loop)

M2 turns the M1.5 economic engine into a playable, browser-based Year 1
vertical slice: landing → election → Bercy audit → energy shock → Budget
Builder → Parliament → simulated Year 1 → report → replay. This document
explains the gameplay architecture added on top of `docs/ARCHITECTURE.md`
and `docs/ECONOMIC_ENGINE.md` — it does not re-explain the engine itself.

## Scope

A single playable Year 1 (3-6 minutes), not the full 5-year mandate. See
the M2 brief's "non-goals" for the long explicit exclusion list (no
campaign system, no full Parliament simulation, no ministers/advisors, no
backend, etc.) — none of that exists here, on purpose.

## Screen flow

```
landing → election → bercyAudit → energyShock → budgetBuilder → parliament → yearReport
                                                                                  │
                                                        ┌─────────────────────────┴───────────────┐
                                                        ▼                                          ▼
                                          REJOUER L'ANNÉE (same seed,                  NOUVELLE PARTIE (new seed,
                                          → back to bercyAudit)                        → back to landing)
```

Each screen is a small React component (`src/app/screens/`); the
`EconomicDashboard` (`src/app/components/`) is the persistent compact
macro readout shown on every gameplay screen from the Bercy audit onward.

## Real engine vs prototype logic

Following M0/M1's architecture split:

- **`src/engine/`** — untouched. M2 adds zero new files here and changes
  zero formulas or config. The calibrated M1.5 engine is used exactly as
  validated.
- **`src/game/country-run/budget/`** and **`src/game/country-run/prototype/`**
  — new for M2. Everything genuinely economic (how a budget category
  changes growth, deficit, debt...) is expressed as an `EconomicPolicyInput`
  delta and handed to the real engine (`advanceEconomicTurn`). Everything
  that ISN'T part of the generic engine (popularity, the Parliament vote,
  the prototype score, the ending title) lives here, clearly marked
  "PROTOTYPE-ONLY" in each file's header comment, and is never leaked into
  `engine/`.
- **`src/app/`** — presentation only. Screens read state and dispatch
  actions; they contain no game rules (the M0 convention, unchanged).

### Which parts use the real M1.5 engine

- Every `EconomicState` field shown anywhere (growth, unemployment,
  inflation, deficit, debt, purchasing power, productivity, interest
  cost, confidence) is a direct, unmodified output of
  `advanceEconomicTurn` — never faked or hand-computed in the UI layer.
- The Bercy audit and energy-shock choices' fiscal effects
  (`currentSpendingChanges`, `transfersChanges`) and the four Budget
  Builder categories' effects (`currentSpendingChanges`,
  `educationInvestment`, `publicInvestmentChanges`) all flow through
  `EconomicPolicyInput` into the real engine.
- The energy shock itself (`oilPriceIndex +28`) is a real
  `ExternalShock`, applied via the engine's own
  `applyExternalShocksToWorld` mechanism (M1's WorldState/ExternalShock
  system), not a hand-scripted inflation bump.
- `simulateYearOne` (`prototype/yearOneFlow.ts`) runs exactly
  `TURNS_PER_YEAR` (6) real turns of `advanceEconomicTurn` — the Year 1
  report's "start vs end" numbers are the literal engine output after 6
  turns, not an approximation.

### Which parts are prototype-only

- **Popularity** (`prototype/popularity.ts`) — a simple, hand-tuned,
  bounded [0, 100] accumulator. Not a validated model, not the
  demographic-subgroup popularity the Product Bible describes for the
  full game (§11) — explicitly out of scope for M2.
- **Parliament** (`prototype/parliament.ts`) — a single seeded coin flip
  against a probability set by the player's negotiating stance. Not the
  "modèle parlementaire exhaustif" the Product Bible keeps out of scope.
  On rejection, a flat 50% scale-down of the enacted policy stands in for
  a "simplified compromise budget" — no re-vote, no government collapse.
- **Scoring and ending titles** (`prototype/scoring.ts`) — a documented,
  bounded heuristic over real start/end `EconomicState`, weighted per the
  M2 brief (economy 25%, finances 25%, purchasing power 20%, services 15%,
  popularity 15%), with a penalty multiplier so one strong metric can't
  fully offset a genuine catastrophe elsewhere. Not a validated score.
- **The live Budget Builder estimate** (`budget/budgetEffects.ts`,
  `estimateBudgetImpact`) — a fast, engine-*informed* approximation shown
  as the player adjusts sliders, recomputed on every change without
  invoking the real engine (too heavy to re-run per click, and not meant
  to reveal an exact forecast anyway — see "Live preview vs real
  simulation" below). The REAL outcome only exists once
  `CHOOSE_PARLIAMENT` actually calls `simulateYearOne`.

## Policy input units (reused from M1.5, unchanged)

Every budget/decision choice in M2 is an **annualized level change**,
exactly the M1.5 convention (`engine/economy/types.ts`, "Policy input
units"): `investment = +15` means "public investment spending is €15bn/year
above baseline while this budget remains active" — never "+€15bn added
every 2-month turn". `simulateYearOne` applies the full merged policy on
turn 1 (relative to a neutral baseline, since nothing was enacted before
Year 1 started) and holds it steady for the remaining 5 turns, so nothing
compounds. This is the exact bug M1.5 fixed, reused here through the same
`computePolicyDelta` mechanism — M2 does not reintroduce it.

## Live preview vs real simulation

The Budget Builder's sticky summary panel updates instantly as the player
adjusts categories, but it is a **fast heuristic**
(`estimateBudgetImpact`), not a call into the real engine — shown
explicitly as ranges ("+0.2 à +0.5 pt"), never a single precise number,
matching the Product Bible's advisor philosophy (§7, §12: ranges and
confidence, never a perfect truth). The real number only exists after
Parliament resolves and `simulateYearOne` actually runs.

## RNG safety under React (M2 §26)

`SeededRng` is a stateful class — sharing one mutable instance across
renders/dispatches would break the moment React's `<StrictMode>`
double-invokes a reducer (which it does, in development, specifically to
catch impure reducers). The fix, used everywhere in the game's UI layer
(`prototype/rng.ts`): **never store a mutable `SeededRng` instance in
state.** Every discrete game action derives a *fresh* `SeededRng` from
`createActionRng(seed, label)`, where `label` is unique to that action
(e.g. `year1-turn-3`, `parliament-vote`). Deriving a fresh instance from a
pure string key means the same action dispatched twice — StrictMode's
double-invoke, or any other re-render — always reproduces the exact same
random draws, because there is no shared mutable state to advance twice.
`gameReducer` itself is a pure function (`gameReducer.test.ts` asserts
this directly: dispatching the same `(state, action)` pair twice yields
identical results), and all simulation-advancing logic runs only inside
that reducer, dispatched only by explicit player button clicks — never
inside a render function or an effect.

The one deliberate exception is picking a brand-new SEED STRING when the
player starts a fresh game (`generateSeed()`, using `crypto.randomUUID()`
with a `Math.random()` fallback) — a one-off "which universe do we start
in" choice, not part of the deterministic simulation itself. From that
point on, every random draw inside the simulation goes through
`SeededRng`.

## Game state (M2 §25)

`GamePrototypeState` (`app/gameReducer.ts`) holds: the current screen, the
seed, the real `GameState` (engine state — economic/political/social/
policy/delayedEffects), the `WorldState`, a one-time `initialEconomicSnapshot`
+ `initialPopularity` (the Year 1 report's fixed baseline), the player's
accumulated `PlayerChoices`, the Parliament outcome, and the final score/
title. Popularity and political credibility are NOT duplicated as separate
UI state — they live in `gameState.political`, updated via the generic
engine's own `applyEffect` (an `add` Effect with `min`/`max` bounds),
reusing the M0 effects system exactly as designed rather than inventing a
parallel mutation path.

## Data provenance

`shared/types/provenance.ts` adds the `DataProvenance` type
(`OBSERVED | FORECAST | GAME_ESTIMATE | SIMULATED`) per the Product
Bible's §19 requirement that figures be traceable. M2 doesn't surface this
in the UI everywhere (not required at this milestone), but the type exists
so a future milestone can wire it through without a rework.

## Known limitations (see the final M2 report for the full list)

- Popularity, Parliament, and scoring are simple, prototype-tuned
  heuristics — explicitly not validated, and documented as such in their
  own files.
- The live Budget Builder estimate is an approximation; only the final
  simulation after Parliament is the real number.
- No persistence — refreshing the page starts a brand-new game (no
  save/local-storage in M2 scope).
