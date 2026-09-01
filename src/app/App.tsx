import { useReducer } from 'react'
import { bercyAuditText, BERCY_AUDIT, ENERGY_SHOCK } from '../game/country-run/prototype/decisions.ts'
import { isFiscallyDifficult, totalEstimatedAnnualCost } from '../game/country-run/promises/promiseSelection.ts'
import type { ParliamentChoiceConfig } from '../game/country-run/prototype/types.ts'
import type { BudgetCategoryId, BudgetLevel } from '../game/country-run/budget/budgetTypes.ts'
import type { PromiseEvaluationContext } from '../game/country-run/promises/promiseTypes.ts'
import { PromiseTracker } from './components/PromiseTracker.tsx'
import { createInitialGamePrototypeState, gameReducer } from './gameReducer.ts'
import { BudgetBuilderScreen } from './screens/BudgetBuilderScreen.tsx'
import { CampaignIntroScreen } from './screens/CampaignIntroScreen.tsx'
import { DecisionScreen } from './screens/DecisionScreen.tsx'
import { ElectionScreen } from './screens/ElectionScreen.tsx'
import { FranceBriefingScreen } from './screens/FranceBriefingScreen.tsx'
import { GovernmentSelectionScreen } from './screens/GovernmentSelectionScreen.tsx'
import { LandingScreen } from './screens/LandingScreen.tsx'
import { LegislativeElectionScreen } from './screens/LegislativeElectionScreen.tsx'
import { MandateStartScreen } from './screens/MandateStartScreen.tsx'
import { ParliamentCompositionScreen } from './screens/ParliamentCompositionScreen.tsx'
import { ParliamentScreen } from './screens/ParliamentScreen.tsx'
import { PromiseConfirmationScreen } from './screens/PromiseConfirmationScreen.tsx'
import { PromiseSelectionScreen } from './screens/PromiseSelectionScreen.tsx'
import { YearReportScreen } from './screens/YearReportScreen.tsx'
import './game.css'

/**
 * Country Run — M3: the full pre-presidency campaign (promises, election,
 * government, legislative election, Parliament) feeding into the existing
 * M2 Year 1 vertical slice. All simulation advancement happens inside
 * `gameReducer` (dispatched only by these explicit callbacks), never during
 * render — see gameReducer.ts / prototype/rng.ts for the React-StrictMode
 * RNG-safety rationale (M2 §26).
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

    case 'campaignIntro':
      return (
        <div className="cr-root">
          <CampaignIntroScreen onBegin={() => { dispatch({ type: 'BEGIN_PROMISE_SELECTION' }) }} />
        </div>
      )

    case 'promiseSelection':
      return (
        <div className="cr-root">
          <PromiseSelectionScreen
            selectedPromiseIds={state.choices.selectedPromiseIds}
            onToggle={(promiseId) => { dispatch({ type: 'TOGGLE_PROMISE', promiseId }) }}
            onConfirm={() => { dispatch({ type: 'CONFIRM_PROMISES' }) }}
          />
        </div>
      )

    case 'promiseConfirmation':
      return (
        <div className="cr-root">
          <PromiseConfirmationScreen
            selectedPromiseIds={state.choices.selectedPromiseIds}
            onProceed={() => { dispatch({ type: 'PROCEED_TO_ELECTION' }) }}
          />
        </div>
      )

    case 'election':
      if (!state.electionResult) return <div className="cr-root" />
      return (
        <div className="cr-root">
          <ElectionScreen electionResult={state.electionResult} onEnter={() => { dispatch({ type: 'VIEW_FRANCE_BRIEFING' }) }} />
        </div>
      )

    case 'franceBriefing':
      return (
        <div className="cr-root">
          <FranceBriefingScreen
            economic={state.gameState.economic}
            worldState={state.worldState}
            onProceed={() => { dispatch({ type: 'PROCEED_TO_GOVERNMENT' }) }}
          />
        </div>
      )

    case 'governmentSelection':
      return (
        <div className="cr-root">
          <GovernmentSelectionScreen onChoose={(profileId) => { dispatch({ type: 'CHOOSE_GOVERNMENT', profileId }) }} />
        </div>
      )

    case 'legislativeElection':
      if (!state.parliamentComposition) return <div className="cr-root" />
      return (
        <div className="cr-root">
          <LegislativeElectionScreen
            composition={state.parliamentComposition}
            onProceed={() => { dispatch({ type: 'VIEW_PARLIAMENT_COMPOSITION' }) }}
          />
        </div>
      )

    case 'parliamentComposition':
      if (!state.parliamentComposition) return <div className="cr-root" />
      return (
        <div className="cr-root">
          <ParliamentCompositionScreen
            composition={state.parliamentComposition}
            onProceed={() => { dispatch({ type: 'PROCEED_TO_MANDATE_START' }) }}
          />
        </div>
      )

    case 'mandateStart':
      if (!state.parliamentComposition || !state.choices.governmentProfileId || state.politicalCapital === null) {
        return <div className="cr-root" />
      }
      return (
        <div className="cr-root">
          <MandateStartScreen
            selectedPromiseIds={state.choices.selectedPromiseIds}
            governmentProfileId={state.choices.governmentProfileId}
            composition={state.parliamentComposition}
            politicalCapital={state.politicalCapital}
            onBegin={() => { dispatch({ type: 'BEGIN_MANDATE' }) }}
          />
        </div>
      )

    case 'bercyAudit': {
      const totalCost = totalEstimatedAnnualCost(state.choices.selectedPromiseIds)
      const decision = { ...BERCY_AUDIT, text: bercyAuditText(totalCost, isFiscallyDifficult(state.choices.selectedPromiseIds)) }
      return (
        <div className="cr-root">
          <DecisionScreen
            decision={decision}
            economic={state.gameState.economic}
            political={state.gameState.political}
            meta={state.gameState.meta}
            onChoose={(choiceId) => { dispatch({ type: 'CHOOSE_BERCY', choiceId }) }}
          />
          <PromiseTrackerSection state={state} />
        </div>
      )
    }

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
          <PromiseTrackerSection state={state} />
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
          <PromiseTrackerSection state={state} />
        </div>
      )

    case 'parliamentVote':
      return (
        <div className="cr-root">
          <ParliamentScreen
            playerSeats={state.parliamentComposition?.playerSeats ?? 0}
            onChoose={(choiceId: ParliamentChoiceConfig['id']) => { dispatch({ type: 'CHOOSE_PARLIAMENT_VOTE', choiceId }) }}
          />
          <PromiseTrackerSection state={state} />
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
          <PromiseTrackerSection state={state} />
        </div>
      )
  }
}

/** Shared "MES 5 ENGAGEMENTS" panel, shown on every screen from mandate start onward (M3 §22-25). */
function PromiseTrackerSection({ state }: { state: ReturnType<typeof createInitialGamePrototypeState> }) {
  if (state.choices.selectedPromiseIds.length === 0) return null
  const context: PromiseEvaluationContext = {
    initialEconomic: state.initialEconomicSnapshot,
    currentEconomic: state.gameState.economic,
    currentTurn: state.gameState.meta.turn,
    policyHistory: state.policyHistory,
  }
  return (
    <div className="cr-page" style={{ paddingTop: 0 }}>
      <PromiseTracker selectedPromiseIds={state.choices.selectedPromiseIds} context={context} />
    </div>
  )
}
