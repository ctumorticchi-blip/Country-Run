import { useReducer } from 'react'
import { BERCY_AUDIT, ENERGY_SHOCK } from '../game/country-run/prototype/decisions.ts'
import type { ParliamentChoiceConfig } from '../game/country-run/prototype/types.ts'
import type { BudgetCategoryId, BudgetLevel } from '../game/country-run/budget/budgetTypes.ts'
import { createInitialGamePrototypeState, gameReducer } from './gameReducer.ts'
import { BudgetBuilderScreen } from './screens/BudgetBuilderScreen.tsx'
import { DecisionScreen } from './screens/DecisionScreen.tsx'
import { ElectionScreen } from './screens/ElectionScreen.tsx'
import { LandingScreen } from './screens/LandingScreen.tsx'
import { ParliamentScreen } from './screens/ParliamentScreen.tsx'
import { YearReportScreen } from './screens/YearReportScreen.tsx'
import './game.css'

/**
 * Country Run — M2 vertical slice: a single Year 1 playthrough from
 * landing screen to final report. All simulation advancement happens
 * inside `gameReducer` (dispatched only by these explicit callbacks),
 * never during render — see gameReducer.ts / prototype/rng.ts for the
 * React-StrictMode RNG-safety rationale (M2 §26).
 */
export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGamePrototypeState)

  switch (state.screen) {
    case 'landing':
      return (
        <div className="cr-root">
          <LandingScreen onStart={() => { dispatch({ type: 'START_GAME' }) }} />
        </div>
      )

    case 'election':
      return (
        <div className="cr-root">
          <ElectionScreen onEnter={() => { dispatch({ type: 'ENTER_ELYSEE' }) }} />
        </div>
      )

    case 'bercyAudit':
      return (
        <div className="cr-root">
          <DecisionScreen
            decision={BERCY_AUDIT}
            economic={state.gameState.economic}
            political={state.gameState.political}
            meta={state.gameState.meta}
            onChoose={(choiceId) => { dispatch({ type: 'CHOOSE_BERCY', choiceId }) }}
          />
        </div>
      )

    case 'energyShock':
      return (
        <div className="cr-root">
          <DecisionScreen
            decision={ENERGY_SHOCK}
            economic={state.gameState.economic}
            political={state.gameState.political}
            meta={state.gameState.meta}
            onChoose={(choiceId) => { dispatch({ type: 'CHOOSE_ENERGY', choiceId }) }}
          />
        </div>
      )

    case 'budgetBuilder':
      return (
        <div className="cr-root">
          <BudgetBuilderScreen
            economic={state.gameState.economic}
            selections={state.choices.budgetSelections}
            onChangeLevel={(category: BudgetCategoryId, level: BudgetLevel) => {
              dispatch({ type: 'SET_BUDGET_LEVEL', category, level })
            }}
            onSubmit={() => { dispatch({ type: 'SUBMIT_BUDGET' }) }}
          />
        </div>
      )

    case 'parliament':
      return (
        <div className="cr-root">
          <ParliamentScreen
            onChoose={(choiceId: ParliamentChoiceConfig['id']) => { dispatch({ type: 'CHOOSE_PARLIAMENT', choiceId }) }}
          />
        </div>
      )

    case 'yearReport':
      if (!state.scoreBreakdown || !state.endingTitle || !state.parliamentOutcome) {
        // Defensive fallback — should be unreachable, the reducer always sets these together (see gameReducer.ts).
        return <div className="cr-root" />
      }
      return (
        <div className="cr-root">
          <YearReportScreen
            initialEconomic={state.initialEconomicSnapshot}
            finalEconomic={state.gameState.economic}
            initialPopularity={state.initialPopularity}
            finalPopularity={state.gameState.political.popularity}
            parliamentOutcome={state.parliamentOutcome}
            scoreBreakdown={state.scoreBreakdown}
            endingTitle={state.endingTitle}
            onReplaySameSeed={() => { dispatch({ type: 'REPLAY_SAME_SEED' }) }}
            onNewGame={() => { dispatch({ type: 'NEW_GAME' }) }}
          />
        </div>
      )
  }
}
