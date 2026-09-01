import { useReducer } from 'react'
import { bercyAuditText, BERCY_AUDIT, ENERGY_SHOCK } from '../game/country-run/prototype/decisions.ts'
import { isFiscallyDifficult, totalEstimatedAnnualCost } from '../game/country-run/promises/promiseSelection.ts'
import type { BudgetCategoryId, BudgetLevel } from '../game/country-run/budget/budgetTypes.ts'
import type { PromiseEvaluationContext } from '../game/country-run/promises/promiseTypes.ts'
import { getGovernmentProfile } from '../game/country-run/government/governmentProfiles.ts'
import { BILL_CATALOG } from '../game/country-run/parliament/bills.ts'
import { BUDGET_BILL_ID } from '../game/country-run/parliament/budgetBillDerivation.ts'
import { MAX_VOTE_ATTEMPTS } from '../game/country-run/parliament/billTypes.ts'
import { applyConcessionsToBill } from '../game/country-run/parliament/concessions.ts'
import { canUseExceptionalProcedure } from '../game/country-run/parliament/exceptionalProcedure.ts'
import { estimateBillSupport } from '../game/country-run/parliament/supportEstimate.ts'
import { PromiseTracker } from './components/PromiseTracker.tsx'
import { createInitialGamePrototypeState, gameReducer, resolveBillDefinition, type GamePrototypeState } from './gameReducer.ts'
import { BillNegotiationScreen } from './screens/BillNegotiationScreen.tsx'
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
import { PromiseConfirmationScreen } from './screens/PromiseConfirmationScreen.tsx'
import { PromiseSelectionScreen } from './screens/PromiseSelectionScreen.tsx'
import { ReformHubScreen } from './screens/ReformHubScreen.tsx'
import { VoteScreen } from './screens/VoteScreen.tsx'
import { YearReportScreen } from './screens/YearReportScreen.tsx'
import './game.css'

/**
 * Country Run — M4: the Budget Bill and one discretionary Year 1 reform
 * both flow through the same negotiation → vote pipeline
 * (`billNegotiation` / `billVote` / `reformHub`), on top of the M3
 * campaign and the M2 Bercy/energy/Budget Builder screens. All simulation
 * advancement happens inside `gameReducer` (dispatched only by these
 * explicit callbacks), never during render — see gameReducer.ts /
 * prototype/rng.ts for the React-StrictMode RNG-safety rationale.
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
              dispatch({ type: justResolvedBudget ? 'PROCEED_TO_REFORM_HUB' : 'CONCLUDE_YEAR_ONE' })
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
      const bills = BILL_CATALOG.map((definition) => {
        const effectiveBill = applyConcessionsToBill(definition, [])
        const support = estimateBillSupport(effectiveBill, composition, state.blocRelations, state.gameState.political.popularity, modifiers, null)
        return { definition, support }
      })
      return (
        <div className="cr-root">
          <ReformHubScreen
            bills={bills}
            politicalCapital={state.politicalCapital}
            onChoose={(billId) => { dispatch({ type: 'PROPOSE_BILL', billId }) }}
            onSkip={() => { dispatch({ type: 'CONCLUDE_YEAR_ONE' }) }}
          />
          <PromiseTrackerSection state={state} />
        </div>
      )
    }

    case 'yearReport':
      if (!state.scoreBreakdown || !state.endingTitle || state.politicalCapital === null) {
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
            politicalCapital={state.politicalCapital}
            billHistory={state.billHistory}
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
      <PromiseTracker selectedPromiseIds={state.choices.selectedPromiseIds} context={context} />
    </div>
  )
}
