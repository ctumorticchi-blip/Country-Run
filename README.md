# Country Run

A short, replayable political/economic simulation — you win the French
presidential election and govern for five years. This repository currently
holds **M0 — Foundation**: a generic simulation engine and a debug shell,
not the game itself.

Product source of truth: `Country_Run_Product_Bible_V1.docx`.
Technical documentation: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Requirements

- Node.js 20+ (developed against Node 22)

## Commands

```bash
npm install     # install dependencies
npm run dev     # start the Vite dev server (debug shell)
npm run test    # run the test suite once (Vitest)
npm run test:watch  # run tests in watch mode
npm run lint    # run ESLint
npm run build   # type-check and build a static production bundle
npm run preview # preview the production build locally
```

## Status

M0 Foundation only: types, a deterministic seeded RNG, a composable
conditions/effects system, delayed effects, a minimal turn engine, a
placeholder (fictional) initial game state, and a bare debug shell UI. No
game content, economic simulation, or Budget Builder yet — see
`docs/ARCHITECTURE.md` for exactly what's in and out of scope.
