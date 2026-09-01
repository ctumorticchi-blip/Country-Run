import { useEffect, useReducer, useState } from 'react'
import { bercyAuditText, BERCY_AUDIT } from '../game/country-run/prototype/decisions.ts'
import { isFiscallyDifficult, totalEstimatedAnnualCost } from '../game/country-run/promises/promiseSelection.ts'
import type { BudgetCategoryId } from '../game/country-run/budget/budgetTypes.ts'
import type { PromiseEvaluationContext } from '../game/country-run/promises/promiseTypes.ts'
import { getGovernmentProfile } from '../game/country-run/government/governmentProfiles.ts'
import { getEventDefinition } from '../game/country-run/events/eventCatalog.ts'
import { isMidtermTurn } from '../game/country-run/mandate/calendar.ts'
import { BUDGET_BILL_ID } from '../game/country-run/parliament/budgetBillDerivation.ts'
import { MAX_VOTE_ATTEMPTS } from '../game/country-run/parliament/billTypes.ts'
import { applyConcessionsToBill } from '../game/country-run/parliament/concessions.ts'
import { canUseExceptionalProcedure } from '../game/country-run/parliament/exceptionalProcedure.ts'
import { estimateBillSupport } from '../game/country-run/parliament/supportEstimate.ts'
import { DetailPanel } from './components/DetailPanel.tsx'
import { NavBar, type NavTab } from './components/NavBar.tsx'
import { PromiseTracker } from './components/PromiseTracker.tsx'
import { availableReformBills, createInitialGamePrototypeState, gameReducer, resolveBillDefinition, type GamePrototypeState } from './gameReducer.ts'
import { loadGame, saveGame } from './save.ts'
import { BillNegotiationScreen } from './screens/BillNegotiationScreen.tsx'
import { BudgetBuilderScreen } from './screens/BudgetBuilderScreen.tsx'
import { CampaignIntroScreen } from './screens/CampaignIntroScreen.tsx'
import { DecisionScreen } from './screens/DecisionScreen.tsx'
import { ElectionScreen } from './screens/ElectionScreen.tsx'
import { EventScreen } from './screens/EventScreen.tsx'
import { FranceBriefingScreen } from './screens/FranceBriefingScreen.tsx'
import { GovernmentSelectionScreen } from './screens/GovernmentSelectionScreen.tsx'
import { LandingScreen } from './screens/LandingScreen.tsx'
import { LegislativeElectionScreen } from './screens/LegislativeElectionScreen.tsx'
import { MandateReviewScreen } from './screens/MandateReviewScreen.tsx'
import { MandateStartScreen } from './screens/MandateStartScreen.tsx'
import { MandateTurnScreen } from './screens/MandateTurnScreen.tsx'
import { ParliamentCompositionScreen } from './screens/ParliamentCompositionScreen.tsx'
import { PromiseConfirmationScreen } from './screens/PromiseConfirmationScreen.tsx'
import { PromiseSelectionScreen } from './screens/PromiseSelectionScreen.tsx'
import { ReformHubScreen } from './screens/ReformHubScreen.tsx'
import { VoteScreen } from './screens/VoteScreen.tsx'
import { YearReviewScreen } from './screens/YearReviewScreen.tsx'
import './game.css'

const NAV_SCREENS = new Set(['mandateTurn', 'event', 'budgetBuilder', 'billNegotiation', 'billVote', 'reformHub', 'yearReview'])

/**
 * Country Run — M5: the full 5-year, 30-turn mandate. The Budget Bill and
 * discretionary reform pipeline (`billNegotiation`/`billVote`/`reformHub`)
 * from M4 now repeats once per gameplay year on top of a per-turn
 * `mandateTurn` loop (advancing the calendar only on the explicit
 * `ADVANCE_TURN` dispatch — never during render), interrupted by `event`
 * whenever `EVENT_CATALOG` fires one. All simulation advancement happens
 * inside `gameReducer`, dispatched only by explicit callbacks — see
 * gameReducer.ts / prototype/rng.ts for the React-StrictMode RNG-safety
 * rationale.
 */
export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGamePrototypeState)
  const [detailTab, setDetailTab] = useState<NavTab | null>(null)
  // Read once at mount — a save with real progress (not just a fresh landing state) offers REPRENDRE LA PARTIE (M5 §56).
  const [savedGame, setSavedGame] = useState<GamePrototypeState | null>(() => {
    const loaded = loadGame()
    return loaded && loaded.screen !== 'landing' ? loaded : null
  })

  // Persisted after every resolved turn/decision — any state change re-saves. Cheap and idempotent (see save.ts).
  useEffect(() => {
    saveGame(state)
  }, [state])

  if (detailTab) {
    return (
      <div className="cr-root">
        <NavBar activeTab={detailTab} onSelect={(tab) => { setDetailTab(tab === detailTab ? null : tab) }} />
        <DetailPanel tab={detailTab} state={state} onClose={() => { setDetailTab(null) }} />
      </div>
    )
  }

  const nav = NAV_SCREENS.has(state.screen) ? <NavBar activeTab={null} onSelect={setDetailTab} /> : null

  switch (state.screen) {
    case 'landing':
      return (
        <div className="cr-root">
          <LandingScreen
            canResume={savedGame !== null}
            onStart={() => {
              setSavedGame(null)
              dispatch({ type: 'START_GAME' })
            }}
            onResume={() => {
              if (!savedGame) return
              dispatch({ type: 'RESUME_SAVED_GAME', savedState: savedGame })
              setSavedGame(null)
            }}
          />
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

    case 'budgetBuilder':
      return (
        <div className="cr-root">
          {nav}
          <BudgetBuilderScreen
            economic={state.gameState.economic}
            budgetLabel={state.currentBudgetLabel ?? 'Budget'}
            selections={state.draftBudgetSelections}
            previousLevels={state.budgetLevels}
            onChangeTier={(category: BudgetCategoryId, tierId: string) => { dispatch({ type: 'SET_BUDGET_TIER', category, tierId }) }}
            onSubmit={() => { dispatch({ type: 'SUBMIT_BUDGET' }) }}
          />
          <PromiseTrackerSection state={state} />
        </div>
      )

    case 'billNegotiation': {
      if (!state.activeBill || !state.parliamentComposition || !state.choices.governmentProfileId || state.politicalCapital === null) {
        return <div className="cr-root" />
      }
      const modifiers = getGovernmentProfile(state.choices.governmentProfileId).modifiers
      const definition = resolveBillDefinition(state, state.activeBill.billId)
      const effectiveBill = applyConcessionsToBill(definition, state.activeBill.appliedConcessionIds)
      const support = estimateBillSupport(effectiveBill, state.parliamentComposition, state.blocRelations, state.gameState.political.popularity, modifiers, {
        courtedBlocIds: state.activeBill.courtedBlocIds,
        capitalSpent: state.activeBill.capitalSpent,
      })
      return (
        <div className="cr-root">
          {nav}
          <BillNegotiationScreen
            effectiveBill={effectiveBill}
            support={support}
            politicalCapital={state.politicalCapital}
            activeBill={state.activeBill}
            canUseExceptional={canUseExceptionalProcedure(state.politicalCapital)}
            onSeekSupport={(blocId) => { dispatch({ type: 'NEGOTIATE_SEEK_SUPPORT', blocId }) }}
            onOfferConcession={(concessionId) => { dispatch({ type: 'NEGOTIATE_OFFER_CONCESSION', concessionId }) }}
            onSpendCapital={(amount) => { dispatch({ type: 'NEGOTIATE_SPEND_CAPITAL', amount }) }}
            onCallVote={() => { dispatch({ type: 'CALL_VOTE' }) }}
            onUseExceptionalProcedure={() => { dispatch({ type: 'USE_EXCEPTIONAL_PROCEDURE' }) }}
          />
          <PromiseTrackerSection state={state} />
        </div>
      )
    }

    case 'billVote': {
      const isTerminal = state.activeBill === null
      const finalEntry = isTerminal ? (state.billHistory[state.billHistory.length - 1] ?? null) : null
      if (isTerminal && !finalEntry) return <div className="cr-root" />
      const billTitle = finalEntry ? finalEntry.billTitle : resolveBillDefinition(state, state.activeBill?.billId ?? '').title
      const canRetry = !isTerminal && (state.activeBill?.voteAttempts ?? 0) < MAX_VOTE_ATTEMPTS
      const canWithdraw = !isTerminal && state.activeBill?.billId !== BUDGET_BILL_ID
      return (
        <div className="cr-root">
          {nav}
          <VoteScreen
            billTitle={billTitle}
            voteResult={state.lastVoteResult}
            finalEntry={finalEntry}
            canRetry={canRetry}
            canWithdraw={canWithdraw}
            onRenegotiate={() => { dispatch({ type: 'RENEGOTIATE_BILL' }) }}
            onWithdraw={() => { dispatch({ type: 'WITHDRAW_BILL' }) }}
            onContinue={() => {
              const justResolvedBudget = finalEntry?.billId === BUDGET_BILL_ID
              dispatch({ type: justResolvedBudget ? 'PROCEED_TO_REFORM_HUB' : 'BEGIN_TURN_LOOP' })
            }}
          />
          <PromiseTrackerSection state={state} />
        </div>
      )
    }

    case 'reformHub': {
      if (!state.parliamentComposition || !state.choices.governmentProfileId || state.politicalCapital === null) {
        return <div className="cr-root" />
      }
      const modifiers = getGovernmentProfile(state.choices.governmentProfileId).modifiers
      const composition = state.parliamentComposition
      const bills = availableReformBills(state).map((definition) => {
        const effectiveBill = applyConcessionsToBill(definition, [])
        const support = estimateBillSupport(effectiveBill, composition, state.blocRelations, state.gameState.political.popularity, modifiers, null)
        return { definition, support }
      })
      return (
        <div className="cr-root">
          {nav}
          <ReformHubScreen
            bills={bills}
            politicalCapital={state.politicalCapital}
            onChoose={(billId) => { dispatch({ type: 'PROPOSE_BILL', billId }) }}
            onSkip={() => { dispatch({ type: 'BEGIN_TURN_LOOP' }) }}
          />
          <PromiseTrackerSection state={state} />
        </div>
      )
    }

    case 'mandateTurn':
      return (
        <div className="cr-root">
          {nav}
          <MandateTurnScreen
            turn={state.gameState.meta.turn}
            economic={state.gameState.economic}
            popularity={state.gameState.political.popularity}
            politicalCapital={state.politicalCapital ?? 0}
            governmentTension={state.governmentTension}
            onAdvance={() => { dispatch({ type: 'ADVANCE_TURN' }) }}
          />
          <PromiseTrackerSection state={state} />
        </div>
      )

    case 'event': {
      if (!state.activeEventId) return <div className="cr-root" />
      const event = getEventDefinition(state.activeEventId)
      return (
        <div className="cr-root">
          {nav}
          <EventScreen
            event={event}
            lastChoice={state.lastEventChoice}
            onChoose={(choiceId) => { dispatch({ type: 'CHOOSE_EVENT', choiceId }) }}
            onContinue={() => { dispatch({ type: 'CONTINUE_AFTER_EVENT' }) }}
          />
          <PromiseTrackerSection state={state} />
        </div>
      )
    }

    case 'yearReview':
      if (!state.finalScoreBreakdown || state.politicalCapital === null) return <div className="cr-root" />
      return (
        <div className="cr-root">
          {nav}
          <YearReviewScreen
            turn={state.gameState.meta.turn}
            isMidterm={isMidtermTurn(state.gameState.meta.turn)}
            initialEconomic={state.initialEconomicSnapshot}
            currentEconomic={state.gameState.economic}
            initialPopularity={state.initialPopularity}
            currentPopularity={state.gameState.political.popularity}
            politicalCapital={state.politicalCapital}
            governmentTension={state.governmentTension}
            scoreBreakdown={state.finalScoreBreakdown}
            onContinue={() => { dispatch({ type: 'CONTINUE_FROM_YEAR_REVIEW' }) }}
          />
          <PromiseTrackerSection state={state} />
        </div>
      )

    case 'mandateReview':
      if (!state.finalScoreBreakdown || !state.endingTitle) return <div className="cr-root" />
      return (
        <div className="cr-root">
          <MandateReviewScreen
            initialEconomic={state.initialEconomicSnapshot}
            finalEconomic={state.gameState.economic}
            initialPopularity={state.initialPopularity}
            finalPopularity={state.gameState.political.popularity}
            promiseResolutions={state.promiseResolutions}
            scoreBreakdown={state.finalScoreBreakdown}
            endingTitle={state.endingTitle}
            onNewGame={() => { dispatch({ type: 'NEW_GAME' }) }}
          />
        </div>
      )
  }
}

/** Shared "MES 5 ENGAGEMENTS" panel, shown on every screen from mandate start onward (M3 §22-25), now resolution-aware (M5 §15-16). */
function PromiseTrackerSection({ state }: { state: GamePrototypeState }) {
  if (state.choices.selectedPromiseIds.length === 0) return null
  const context: PromiseEvaluationContext = {
    initialEconomic: state.initialEconomicSnapshot,
    currentEconomic: state.gameState.economic,
    currentTurn: state.gameState.meta.turn,
    policyHistory: state.policyHistory,
  }
  return (
    <div className="cr-page" style={{ paddingTop: 0 }}>
      <PromiseTracker selectedPromiseIds={state.choices.selectedPromiseIds} context={context} resolutions={state.promiseResolutions} />
    </div>
  )
}
