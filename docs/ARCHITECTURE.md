# Architecture — Country Run (M0 Foundation)

This document describes the technical foundation built at Milestone M0. It
is a companion to `Country_Run_Product_Bible_V1.docx`, the product source of
truth — this document only covers *how the code is organized*, not what the
game is.

## Scope of M0

M0 builds a clean, testable technical foundation: a generic simulation
engine, a minimal (fictional, placeholder) game state for Country Run, and a
debug shell to exercise it. It deliberately does **not** build:

- the Economic Engine's actual calculations (Product Bible §6),
- the Budget Builder,
- Year 1 content (decisions, events, promises, scenarios),
- scoring, campaign, government/parliament mechanics,
- any real design/UI polish.

These are explicitly out of scope until M0 is validated. See "What is
explicitly out of M0" below for the full list.

## High-level structure

```text
src/
  engine/          — generic simulation engine, knows nothing about Country Run
    conditions/    — composable predicates over a GameState
    effects/       — state mutations + delayed effects queue
    events/        — generic GameEvent shape + eligibility/roll helpers
    economy/        — reserved for the Economic Engine (M1+); empty in M0
    scoring/         — reserved for final scoring (M1+); empty in M0
    seeded-rng/    — deterministic PRNG
    state/         — GameState shape, turn engine, decision/promise/advisor types

  game/
    country-run/   — Country Run's own content and data, built on engine/ types
      data/        — createInitialGameState() + placeholder starting values
      decisions/   — reserved, empty in M0
      events/      — reserved, empty in M0
      promises/    — reserved, empty in M0
      scenarios/   — reserved, empty in M0

  shared/          — cross-cutting code with no game logic
    ui/            — tiny presentational React components (no business logic)
    utils/         — generic helpers (e.g. path get/set) used by engine and app
    types/         — small cross-cutting type aliases (e.g. StatePath)

  app/             — the debug shell: wires engine + game/country-run into React
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
  economic: { gdp, growth, inflation, unemployment, deficitRatio, debt, debtRatio, purchasingPower }
  political: { popularity, parliamentSeats, politicalCredibility }
  social: { socialTension }
  policy: { activePolicies: string[] }
  delayedEffects: DelayedEffect[]
}
```

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

`advanceTurn` is pure — it never mutates its argument. **No economic
simulation runs here yet.** GDP, unemployment, inflation, etc. are static
until the Economic Engine (M1+, `engine/economy/`) is built on top of this
turn loop.

## Debug shell (`app/`)

`src/app/App.tsx` is a minimal, deliberately undesigned UI: it shows the
game name, seed, turn, year/month, phase, and a handful of economic/social
numbers, plus "Advance Turn" and "Reset" buttons. `src/app/useGameSession.ts`
wires `advanceTurn` and `createInitialGameState` into a `useReducer` — this
is the "simple state management" called for; no external state library is
justified at this scope. `shared/ui/StatCard.tsx` is the one tiny
presentational component factored out for reuse; it contains no game logic.

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
  dispatch to the engine; they do not implement game rules. `App.tsx` and
  `StatCard.tsx` contain zero decisions about game mechanics.
- **No scattered magic numbers.** The one gameplay constant in M0 (2
  months per turn) lives in a single named constant in `turnEngine.ts`, not
  inlined at each call site. Economic coefficients don't exist yet — when
  the Economic Engine is built, the Product Bible's constraint that "every
  significant economic coefficient must be configurable, not buried in the
  UI" (§16) applies there.
- **`.ts` extensions in imports.** Vite + modern TS resolution wants
  explicit extensions on relative imports; this repo uses them consistently
  rather than mixing conventions.

## What is explicitly out of M0

Per the Product Bible and the M0 brief, none of the following exist yet,
on purpose:

- Economic Engine calculations (GDP/revenue/deficit/debt/unemployment/
  inflation/confidence formulas) — `engine/economy/` is an empty,
  documented placeholder.
- Budget Builder.
- Any Year 1 content: decisions, events (e.g. the energy shock), promises,
  scenario sequencing — `game/country-run/{decisions,events,promises,
  scenarios}/` are empty, documented placeholders.
- Campaign / promise selection, government formation, Parliament and
  negotiation mechanics.
- Scoring (`engine/scoring/` is an empty, documented placeholder).
- Analytics, sharing, leaderboards, save/versioning of `GameState`.
- Any real visual design — the debug shell is intentionally bare.
- The real, sourced France 2027 dataset — `game/country-run/data/
  initialState.ts` uses explicitly-labeled fictional placeholder numbers
  (see that file's top comment and Product Bible §19).

Building any of the above is M1+ work.
