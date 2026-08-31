# Country Run

A short, replayable political/economic simulation — you win the French
presidential election and govern for five years. This repository currently
holds **M0 — Foundation** and **M1 — Economic Engine**: a generic
simulation engine plus a macroeconomic model, exercised through a debug
shell, not the game itself.

Product source of truth: `Country_Run_Product_Bible_V1.docx`.
Technical documentation: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
(overall foundation) and
[`docs/ECONOMIC_ENGINE.md`](docs/ECONOMIC_ENGINE.md) (the economic model:
units, formulas, configuration, calibration status).

## Requirements

- Node.js 20+ (developed against Node 22)

## Commands

```bash
npm install     # install dependencies
npm run dev     # start the Vite dev server (debug shell)
npm run test    # run the test suite once (Vitest)
npm run test:watch     # run tests in watch mode
npm run test:scenarios # run the 3-scenario, 5-year economic engine comparison (prints a table)
npm run lint    # run ESLint
npm run build   # type-check and build a static production bundle
npm run preview # preview the production build locally
```

## Status

M0 Foundation + M1 Economic Engine: types, a deterministic seeded RNG, a
composable conditions/effects system, delayed effects, a minimal turn
engine, and a full (config-driven, seeded, deterministic) macroeconomic
simulation — GDP, unemployment, inflation, public revenue/spending/debt,
interest rates, purchasing power, productivity, and confidence — all
running independently of React. Still just a placeholder (fictional)
initial game state and a bare debug shell UI; no game content, Budget
Builder UI, or the real France dataset yet — see `docs/ARCHITECTURE.md`
and `docs/ECONOMIC_ENGINE.md` for exactly what's in and out of scope.
