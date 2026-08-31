# Country Run

A short, replayable political/economic simulation — you win the French
presidential election and govern for five years. This repository currently
holds a playable **Year 1 vertical slice** (M0 Foundation + M1/M1.5
Economic Engine + M2 Budget Builder & gameplay loop): start the game, make
a few political decisions, build a budget, face Parliament, and see a
Year 1 report — not yet the full 5-year mandate.

Product source of truth: `Country_Run_Product_Bible_V1.docx`.
Technical documentation:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (overall foundation),
[`docs/ECONOMIC_ENGINE.md`](docs/ECONOMIC_ENGINE.md) (the economic model:
units, formulas, configuration, calibration status), and
[`docs/GAMEPLAY_M2.md`](docs/GAMEPLAY_M2.md) (the Year 1 gameplay loop,
screen flow, and prototype-vs-engine split).

## Requirements

- Node.js 20+ (developed against Node 22)

## Commands

```bash
npm install     # install dependencies
npm run dev     # start the Vite dev server (the game)
npm run test    # run the test suite once (Vitest)
npm run test:watch     # run tests in watch mode
npm run test:scenarios # run the 3-scenario, 5-year economic engine comparison (prints a table)
npm run lint    # run ESLint
npm run build   # type-check and build a static production bundle
npm run preview # preview the production build locally
```

## Status

A playable Year 1: landing screen → election → a Bercy fiscal-audit
decision → an energy-price shock decision → a 4-category Budget Builder →
a simplified Parliament vote → a real 6-turn simulation of the M1.5
economic engine → a Year 1 report with a prototype score and ending title
→ replay (same seed) or a new game (new seed).

The underlying simulation — GDP, unemployment, inflation, public
revenue/spending/debt, interest rates, purchasing power, productivity, and
confidence — is the config-driven, seeded, deterministic M1.5 engine,
running independently of React. Popularity, the Parliament vote, and
scoring are simple, explicitly-documented prototype heuristics on top of
it (see `docs/GAMEPLAY_M2.md`). Still ahead: the full 5-year mandate, the
real France dataset, campaign/promise systems, and a validated (not
prototype) political layer — see `docs/ARCHITECTURE.md`,
`docs/ECONOMIC_ENGINE.md`, and `docs/GAMEPLAY_M2.md` for exactly what's in
and out of scope.
