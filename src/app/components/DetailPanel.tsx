import type { EconomicState } from '../../engine/state/gameState.ts'
import { formatTurnPeriod } from '../../game/country-run/mandate/calendar.ts'
import { getRelation, type BlocRelations } from '../../game/country-run/parliament/blocRelations.ts'
import type { BillHistoryEntry } from '../../game/country-run/parliament/billTypes.ts'
import type { PolicyHistoryEntry } from '../../game/country-run/prototype/policyHistory.ts'
import type { ParliamentComposition } from '../../game/country-run/prototype/parliamentComposition.ts'
import { ABSOLUTE_MAJORITY, TOTAL_SEATS } from '../../game/country-run/prototype/parliament.ts'
import type { PromiseEvaluationContext } from '../../game/country-run/promises/promiseTypes.ts'
import { formatPercent, purchasingPowerIndex } from '../format.ts'
import { PromiseTracker } from './PromiseTracker.tsx'
import type { NavTab } from './NavBar.tsx'
import type { GamePrototypeState } from '../gameReducer.ts'

interface DetailPanelProps {
  tab: NavTab
  state: GamePrototypeState
  onClose: () => void
}

function EconomyDetail({ economic }: { economic: EconomicState }) {
  return (
    <div className="cr-indicator-grid">
      {[
        ['Croissance', formatPercent(economic.growth)],
        ['Chômage', formatPercent(economic.unemployment)],
        ['Inflation', formatPercent(economic.inflation)],
        ['Déficit', `${formatPercent(economic.deficitRatio)} PIB`],
        ['Dette', `${formatPercent(economic.debtRatio, 0)} PIB`],
        ['Pouvoir d’achat', purchasingPowerIndex(economic.purchasingPower).toFixed(1)],
        ['Confiance des marchés', `${economic.marketConfidence.toFixed(0)} / 100`],
        ['Taux d’intérêt effectif', formatPercent(economic.effectiveDebtRate)],
      ].map(([label, value]) => (
        <div className="cr-indicator" key={label}>
          <span className="cr-indicator__label">{label}</span>
          <span className="cr-indicator__value">{value}</span>
        </div>
      ))}
    </div>
  )
}

function AssemblyDetail({ composition, blocRelations }: { composition: ParliamentComposition; blocRelations: BlocRelations }) {
  return (
    <>
      <div className="cr-card">
        <div className="cr-seats-bar cr-seats-bar--stacked">
          {composition.blocs.map((bloc) => (
            <div key={bloc.id} className="cr-seats-bar__segment" style={{ width: `${String((bloc.seats / TOTAL_SEATS) * 100)}%` }} title={bloc.name} />
          ))}
          <div className="cr-seats-bar__majority-mark" style={{ left: `${String((ABSOLUTE_MAJORITY / TOTAL_SEATS) * 100)}%` }} />
        </div>
      </div>
      <ul className="cr-bloc-list">
        {composition.blocs.map((bloc) => {
          const relation = bloc.isPlayerCoalition ? null : getRelation(blocRelations, bloc.id)
          return (
            <li key={bloc.id} className="cr-report-row">
              <span className="cr-report-row__label">
                {bloc.name}
                {bloc.isPlayerCoalition ? ' (vous)' : ''}
              </span>
              <span className="cr-report-row__value">
                {bloc.seats} sièges{relation !== null ? ` · relation ${relation > 0 ? '+' : ''}${String(relation)}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function HistoryDetail({ billHistory, policyHistory }: { billHistory: BillHistoryEntry[]; policyHistory: PolicyHistoryEntry[] }) {
  type Entry = { turn: number; label: string; detail: string }
  const billEntries: Entry[] = billHistory.map((e) => ({ turn: e.turn, label: e.billTitle, detail: e.status }))
  const policyEntries: Entry[] = policyHistory.map((e) => ({ turn: e.turn, label: e.label, detail: e.amount !== undefined ? `${String(e.amount)} Md€/an` : '' }))
  const entries = [...billEntries, ...policyEntries].sort((a, b) => a.turn - b.turn)

  return (
    <ul className="cr-recap-list">
      {entries.map((entry, i) => (
        <li key={`${String(entry.turn)}-${String(i)}`} className="cr-report-row">
          <span className="cr-report-row__label">
            {formatTurnPeriod(entry.turn)} — {entry.label}
          </span>
          <span className="cr-report-row__value">{entry.detail}</span>
        </li>
      ))}
      {entries.length === 0 ? <li className="cr-body-text">Rien à afficher pour l’instant.</li> : null}
    </ul>
  )
}

/** M5 §60: the 4 read-only info views reachable from `NavBar` — Economy/Promises/Assembly/History. Rendered as a full-screen overlay over whatever mandate-loop screen is active; closing it never changes game state. */
export function DetailPanel({ tab, state, onClose }: DetailPanelProps) {
  const promiseContext: PromiseEvaluationContext = {
    initialEconomic: state.initialEconomicSnapshot,
    currentEconomic: state.gameState.economic,
    currentTurn: state.gameState.meta.turn,
    policyHistory: state.policyHistory,
  }

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--secondary cr-button--small" onClick={onClose}>
            ← RETOUR
          </button>
        </div>

        {tab === 'economy' ? <EconomyDetail economic={state.gameState.economic} /> : null}
        {tab === 'promises' ? <PromiseTracker selectedPromiseIds={state.choices.selectedPromiseIds} context={promiseContext} resolutions={state.promiseResolutions} /> : null}
        {tab === 'assembly' && state.parliamentComposition ? (
          <AssemblyDetail composition={state.parliamentComposition} blocRelations={state.blocRelations} />
        ) : null}
        {tab === 'history' ? <HistoryDetail billHistory={state.billHistory} policyHistory={state.policyHistory} /> : null}
      </div>
    </div>
  )
}
