import { useReducer } from 'react'
import { advanceTurn } from '../engine/state/turnEngine.ts'
import type { GameState, Seed } from '../engine/state/gameState.ts'
import { createInitialGameState } from '../game/country-run/data/initialState.ts'

/** Fixed seed for the debug shell so a Reset is reproducible, not random. */
const DEFAULT_SEED: Seed = 'country-run-dev'

type Action = { type: 'ADVANCE_TURN' } | { type: 'RESET' }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ADVANCE_TURN':
      return advanceTurn(state)
    case 'RESET':
      return createInitialGameState(DEFAULT_SEED)
  }
}

/** Wires the (stateless) engine functions into React state for the debug shell. */
export function useGameSession() {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialGameState(DEFAULT_SEED))

  return {
    state,
    advanceTurn: () => {
      dispatch({ type: 'ADVANCE_TURN' })
    },
    reset: () => {
      dispatch({ type: 'RESET' })
    },
  }
}
