# Architecture — Country Run (M0 Foundation + M1/M1.5 Economic Engine + M2 Gameplay)

This document describes the technical foundation built at Milestone M0 and
extended at M1/M1.5 and M2. It is a companion to
`Country_Run_Product_Bible_V1.docx`, the product source of truth — this
document only covers *how the code is organized*, not what the game is.
The Economic Engine itself (formulas, units, annualization, configuration,
calibration status) is documented separately in `docs/ECONOMIC_ENGINE.md`,
and the Year 1 gameplay loop built on top of it in `docs/GAMEPLAY_M2.md` —
this file only describes where each piece sits in the overall architecture.

## Scope of M0, M1/M1.5, and M2

M0 built a clean, testable technical foundation: a generic simulation
engine, a minimal (fictional, placeholder) game state for Country Run, and a
debug shell to exercise it. M1/M1.5 built and calibrated the macroeconomic
simulation (`engine/economy/`) on top of that foundation — see
`docs/ECONOMIC_ENGINE.md` for details. M2 built a playable Year 1 vertical
slice (Budget Builder, a Bercy audit and energy-shock decision, a
simplified Parliament vote, a Year 1 report) on top of the calibrated
engine, without modifying it — see `docs/GAMEPLAY_M2.md`. Together they
deliberately do **not** build:

- the full 5-year mandate,
- the full campaign/promise system, a real Parliament simulation, or
  ministers/advisors,
- scoring or a popularity model validated beyond a documented prototype,
- the real, sourced France 2027 dataset,
- accounts, a backend, a database, or multiplayer.

These are explicitly out of scope until the vertical slice is validated.
See "What is explicitly out of scope" below for the full list.

## High-level structure

```text
src/
  engine/          — generic simulation engine, knows nothing about Country Run
    conditions/    — composable predicates over a GameState
    effects/       — state mutations + delayed effects queue
    events/        — generic GameEvent shape + eligibility/roll helpers
    economy/       — the Economic Engine (M1); see docs/ECONOMIC_ENGINE.md
    scoring/       — reserved for final scoring (M-later); empty
    seeded-rng/    — deterministic PRNG
    state/         — GameState shape, turn engine, calendar, decision/promise/advisor types

  game/
    country-run/   — Country Run's own content and data, built on engine/ types
      data/        — createInitialGameState()/createInitialWorldState() + placeholder starting values
      budget/      — M2 Budget Builder: category config + engine-facing effects (see docs/GAMEPLAY_M2.md)
      prototype/   — M2 Year 1 flow: decisions content, popularity/Parliament/scoring heuristics, RNG-safety helper
      decisions/   — reserved, empty (content beyond the M2 Bercy/energy decisions)
      events/      — reserved, empty in M0
      promises/    — reserved, empty in M0
      scenarios/   — reserved, empty in M0

  shared/          — cross-cutting code with no game logic
    ui/            — tiny presentational React components (no business logic)
    utils/         — generic helpers (e.g. path get/set) used by engine and app
    types/         — small cross-cutting type aliases (e.g. StatePath, DataProvenance)

  app/             — the Year 1 vertical slice's UI: wires engine + game/country-run into React
    components/    — reusable presentational pieces (dashboard, decision card, budget card...)
    screens/       — one component per screen in the flow (see docs/GAMEPLAY_M2.md)
    gameReducer.ts — the single reducer driving the whole playthrough (pure — see rng.ts for why)
```

The separation is strict in one direction: `engine/` never imports from
`game/` or `app/`. `game/country-run/` imports from `engine/` (it builds
content using the engine's generic types) and from `shared/`. `app/` imports
from all three to assemble the UI.

## GameState

`GameState` (`src/engine/state/gameState.ts`) is the single serializable
snapshot of a run:

```ts
GameState = {
  meta: { seed, turn, year, month, phase }
  economic: EconomicState  // see docs/ECONOMIC_ENGINE.md for the full field list, units, and formulas (M1)
  political: { popularity, parliamentSeats, politicalCredibility }
  social: { socialTension }
  policy: { activePolicies: string[] }
  delayedEffects: DelayedEffect[]
}
```

`EconomicState` was extended at M1 from M0's handful of headline numbers to
the full set the Economic Engine computes (GDP levels, potential/actual
growth, unemployment split into cyclical/structural, the fiscal aggregates,
debt and its interest rate, purchasing power, productivity, and the three
confidence indices) — see `engine/state/gameState.ts` and
`docs/ECONOMIC_ENGINE.md` ("Units").

Notes on deliberate adaptations from the spec:

- `turn`, `year`, `month`, and `seed` are grouped under a `meta` object
  (rather than being four separate top-level fields) alongside `phase`,
  which is what `GameMeta` is for. This keeps "when/who" concerns together
  and separate from the simulation's economic/political/social/policy
  slices.
- The `Promise` type is named `GamePromise` in code — the bare name
  `Promise` would shadow the built-in ECMAScript `Promise` type in every
  file that imports it.

`GameState` is a plain, JSON-serializable object: no `Set`/`Map`/class
instances inside it, no circular references. That's intentional — the
Product Bible requires state to be serializable (§16), and this is what
makes save/replay and Daily Run seeds possible later without rework.

State is never mutated in place anywhere in `engine/`. Every function that
"changes" a `GameState` (effects, delayed effect resolution, `advanceTurn`)
takes a state and returns a *new* state, built with shallow copies
(structural sharing — unaffected branches keep the same object reference).
This is enforced by tests ("never mutates the original state") rather than
by a runtime immutability wrapper, to keep the dependency footprint at
zero.

## Seeded RNG

`src/engine/seeded-rng/SeededRng.ts` implements a small deterministic PRNG
(mulberry32, seeded via an FNV-1a hash of the seed string). No external
dependency.

Guarantee: constructing two `SeededRng` instances with the same seed string
and calling the same sequence of methods on each produces identical
results, forever. Different seeds produce different (and not trivially
correlated) trajectories. This is what makes Daily Run / Challenge seeds and
exact replay possible (Product Bible §15, §16, §20).

API: `next()` (float in [0,1)), `integer(min, max)` (inclusive both ends),
`float(min, max)`, `chance(probability)`, `pick(array)`. All are deterministic
given the generator's current internal state.

At M0, the RNG is implemented and tested but not yet wired into any gameplay
system (no economic noise, no event rolls happen automatically) — there is
no gameplay content yet to drive with it. `engine/events/eligibility.ts`
shows the intended integration point (`rollEventTrigger(event, rng)`).

## Conditions

`src/engine/conditions/` implements a small data-driven boolean expression
language over a `GameState`, so that future content (decisions, events,
promise unlocks) can declare requirements as data rather than code.

```ts
type Condition =
  | { type: 'eq' | 'neq', path, value }
  | { type: 'gt' | 'gte' | 'lt' | 'lte', path, value: number }
  | { type: 'hasPolicy', policyId }
  | { type: 'and' | 'or', conditions: Condition[] }
  | { type: 'not', condition: Condition }
```

`path` is a dot-separated string resolved at runtime against the
`GameState` (e.g. `"economic.unemployment"`), via
`shared/utils/path.ts#getValueAtPath`. This means paths are not statically
type-checked — a typo silently resolves to `undefined` (which reads as
`false`/`NaN` for comparisons) rather than a compile error. This is a
conscious trade-off for M0: a fully type-safe path system (mapped types
deriving valid paths from `GameState`) is the kind of generic complexity the
Product Bible explicitly warns against building prematurely. Revisit if
content authoring produces enough silent-typo bugs to justify it.

`hasPolicy` exists as its own condition type (rather than being expressible
via the comparison operators) because policies live in an array
(`policy.activePolicies: string[]`), and array membership isn't a
`path`/`value` comparison.

`evaluateCondition(condition, state): boolean` in `evaluate.ts` recursively
evaluates the tree. `and`/`or`/`not` compose arbitrarily deep trees — e.g.
`unemployment > 9 AND turn >= 8` is:

```ts
{
  type: 'and',
  conditions: [
    { type: 'gt', path: 'economic.unemployment', value: 9 },
    { type: 'gte', path: 'meta.turn', value: 8 },
  ],
}
```

## Effects

`src/engine/effects/` implements the mirror-image mutation system:

```ts
type Effect =
  | { type: 'set', path, value }
  | { type: 'add' | 'subtract', path, value: number, min?, max? }
  | { type: 'addPolicy' | 'removePolicy', policyId }
```

`applyEffect(state, effect): GameState` returns a new state with the effect
applied; `applyEffects(state, effects[])` folds a sequence in order. `add`
and `subtract` clamp the result to `[min, max]` when those are provided
(e.g. popularity should never exceed 100 or drop below 0). `addPolicy` /
`removePolicy` are idempotent (adding an already-active policy, or removing
an absent one, is a no-op that returns the same shape).

Effects have no knowledge of the UI, of decisions, or of events — they are
purely "given a state and an instruction, produce the next state". Content
(decisions, events) references `Effect` values; it does not reimplement
mutation logic.

## Delayed effects

`src/engine/effects/delayedEffect.ts` implements deferred consequences —
"a reform voted at turn 4 affects productivity at turn 10" (Product Bible
§6, "Temporalité des effets").

```ts
DelayedEffect = { id, effect: Effect, executeAtTurn: Turn, sourceId? }
```

- `scheduleDelayedEffect(state, delayedEffect)` appends it to
  `state.delayedEffects` (immutably).
- `resolveDueDelayedEffects(state)` applies every entry whose
  `executeAtTurn <= state.meta.turn`, in queue order, and removes them from
  the queue; entries not yet due are left untouched. If nothing is due it
  returns the same state reference (no unnecessary copy).

`resolveDueDelayedEffects` is called automatically by `advanceTurn` on every
turn, so scheduling a delayed effect and then advancing turns is enough —
callers never need to poll the queue themselves.

## Turn engine

`src/engine/state/turnEngine.ts` exports `advanceTurn(state): GameState`,
the entire M0 turn loop:

1. increment `meta.turn`,
2. advance the calendar by 2 in-fiction months (6 turns/year, per Product
   Bible §2), rolling `month` over into `year` as needed,
3. resolve any due delayed effects.

`advanceTurn` is pure — it never mutates its argument, and it is
**unchanged since M0**. M1 layers the Economic Engine on top of it rather
than modifying it: `engine/economy/advanceEconomy.ts#advanceEconomicTurn`
calls `advanceTurn` first (calendar + due delayed effects), then runs the
turn's economic computation, then merges the result — including any newly
scheduled structural delayed effects — into a full `GameState`. See
`docs/ECONOMIC_ENGINE.md` ("Order of execution for one turn") for the
complete pipeline.

## The Year 1 vertical slice (`app/`)

As of M2, `src/app/App.tsx` renders the actual playable game (it replaced
M0's bare debug shell — see git history if that minimal UI is ever needed
again). `src/app/gameReducer.ts` is the single `useReducer` reducer
driving the whole playthrough: every screen dispatches a plain action
(`START_GAME`, `CHOOSE_BERCY`, `CHOOSE_PARLIAMENT`, ...), and the reducer
— a pure function — computes the next `GamePrototypeState`, including the
one action (`CHOOSE_PARLIAMENT`) that actually advances the real economic
simulation. `src/app/screens/` holds one component per screen;
`src/app/components/` holds the reusable pieces (`EconomicDashboard`,
`DecisionCard`, `BudgetCategoryCard`, `BudgetSummary`, `Indicator`). None
of these contain game rules — they read `GamePrototypeState` and dispatch
actions. See `docs/GAMEPLAY_M2.md` for the full screen flow, the
prototype-vs-real-engine split, and the RNG-safety design
(`game/country-run/prototype/rng.ts`) that keeps this reducer pure and
safe under React's `<StrictMode>`.

## Conventions

- **No `any`.** ESLint's `@typescript-eslint/no-explicit-any` is set to
  `error`; `tsconfig` runs in `strict` mode with `noUnusedLocals`,
  `noUnusedParameters`, and `strictTypeChecked` lint rules enabled.
- **Immutability by convention, verified by tests.** Engine functions never
  mutate their input; this is enforced by "does not mutate the original
  state" tests rather than a runtime freeze, to avoid adding a dependency
  or performance overhead for something the type system and tests already
  cover well enough at this scale.
- **No business logic in React components.** Components read from and
  dispatch to the engine; they do not implement game rules. Every screen
  and component under `app/` contains zero decisions about game
  mechanics — those live in `gameReducer.ts` and `game/country-run/`.
- **No scattered magic numbers.** The calendar constant (2 months per
  turn, 6 turns/year) lives in `engine/state/calendar.ts`, the single
  place both the turn engine and the Economic Engine's annualization
  helpers read it from. Every Economic Engine coefficient lives in
  `engine/economy/config/` (Product Bible §16) — no formula file has a
  bare numeric literal.
- **`.ts` extensions in imports.** Vite + modern TS resolution wants
  explicit extensions on relative imports; this repo uses them consistently
  rather than mixing conventions.

## What is explicitly out of scope

Per the Product Bible and the M0/M1/M2 briefs, none of the following exist
yet, on purpose:

- The full 5-year mandate — M2 plays exactly one Year 1, then loops back
  to replay/new-game.
- The full campaign/promise system (the player doesn't choose 5 promises;
  the Bercy audit references a fixed "~35 Md€" narrative figure instead),
  government formation, a real Parliament simulation ("modèle
  parlementaire exhaustif"), ministers, or an advisors system.
- A validated (non-prototype) popularity model — Product Bible §11's
  demographic-subgroup popularity is out of scope; M2's popularity is a
  single documented heuristic number (`game/country-run/prototype/popularity.ts`).
- A validated (non-prototype) scoring/ending-title system
  (`game/country-run/prototype/scoring.ts`) — `engine/scoring/` remains an
  empty, documented placeholder; the real scoring logic, if ever
  generalized, does not belong there without further validation.
- Analytics, authentication, a database, save/versioning of `GameState`
  across sessions, or multiplayer.
- Real leaderboards or monetization.
- The real, sourced France 2027 dataset — `game/country-run/data/
  initialState.ts` uses explicitly-labeled fictional placeholder numbers,
  now picked to roughly match an approximate calibration reference (see
  that file's top comment, docs/ECONOMIC_ENGINE.md's "Calibration
  Status", and Product Bible §19).

Building any of the above is later-milestone work.
