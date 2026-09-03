import { useState } from 'react'
import type { EconomicState } from '../../engine/state/gameState.ts'
import { memoriesForArc, type EventMemory } from '../../engine/events/memory.ts'
import { debtInterestShareOfSpending } from '../../game/country-run/finance/financeEffects.ts'
import { computePrimaryBalance } from '../../game/country-run/finance/primaryBalance.ts'
import { formatTurnPeriod, turnToDate } from '../../game/country-run/mandate/calendar.ts'
import { getRelation, type BlocRelations } from '../../game/country-run/parliament/blocRelations.ts'
import type { BillHistoryEntry } from '../../game/country-run/parliament/billTypes.ts'
import type { PolicyHistoryEntry } from '../../game/country-run/prototype/policyHistory.ts'
import type { ParliamentComposition } from '../../game/country-run/prototype/parliamentComposition.ts'
import { ABSOLUTE_MAJORITY, TOTAL_SEATS } from '../../game/country-run/prototype/parliament.ts'
import type { PromiseEvaluationContext } from '../../game/country-run/promises/promiseTypes.ts'
import { getEventDefinition } from '../../game/country-run/events/eventCatalog.ts'
import type { NationalProject, NationalProjectCategory } from '../../game/country-run/projects/projectTypes.ts'
import { canRecapitalize, maxTransferableDividend, netValueCreated, SOVEREIGN_FUND_CAPITALIZATION_TIERS } from '../../game/country-run/fund/fundEngine.ts'
import type { SovereignFundFundingSource, SovereignFundGovernance, SovereignFundState, SovereignFundStrategy } from '../../game/country-run/fund/fundTypes.ts'
import { formatMdFr, formatPercent, formatSignedMdFr, purchasingPowerIndex } from '../format.ts'
import { PromiseTracker } from './PromiseTracker.tsx'
import type { NavTab } from './NavBar.tsx'
import type { GameAction, GamePrototypeState } from '../gameReducer.ts'

interface DetailPanelProps {
  tab: NavTab
  state: GamePrototypeState
  dispatch: (action: GameAction) => void
  onClose: () => void
}

function EconomyDetail({ economic }: { economic: EconomicState }) {
  const primaryBalance = computePrimaryBalance(economic)
  return (
    <div className="cr-indicator-grid">
      {[
        ['Croissance', formatPercent(economic.growth)],
        ['Chômage', formatPercent(economic.unemployment)],
        ['Inflation', formatPercent(economic.inflation)],
        ['Déficit', `${formatPercent(economic.deficitRatio)} PIB`],
        ['Dette', `${formatPercent(economic.debtRatio, 0)} PIB`],
        ['Solde primaire', `${primaryBalance.primaryBalanceBn.toFixed(0)} Md€`],
        ['Charge de la dette', `${economic.interestCost.toFixed(0)} Md€ (${debtInterestShareOfSpending(economic).toFixed(1)}% des dépenses)`],
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

const PROJECT_CATEGORY_LABELS: Record<NationalProjectCategory, string> = {
  TRANSPORT: 'Transport',
  ENERGY: 'Énergie',
  HEALTH: 'Santé',
  RESEARCH: 'Recherche',
  INDUSTRY: 'Industrie',
  HOUSING: 'Logement',
  DEFENSE: 'Défense',
  DIGITAL: 'Numérique',
  CLIMATE: 'Climat',
}

/** M6.5 Part III: the investment dashboard — active projects show a progress bar + construction-phase effects, completed ones a compact recap. Never touches fiscal state (display only — see projectTypes.ts). */
function ProjectsDetail({ projects }: { projects: readonly NationalProject[] }) {
  const active = projects.filter((p) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED')
  const completed = projects.filter((p) => p.status === 'COMPLETED')

  return (
    <div className="cr-card">
      <h3 className="cr-section-title">GRANDS PROJETS NATIONAUX</h3>
      {projects.length === 0 ? (
        <p className="cr-body-text">Aucun grand projet engagé pour l’instant — l’adoption d’un budget d’investissement, d’une réforme ou d’une décision d’événement peut en déclencher un.</p>
      ) : (
        <>
          <ul className="cr-project-list">
            {active.map((project) => (
              <li key={project.id} className="cr-card cr-project-card">
                <div className="cr-finance-block__head">
                  <strong>{project.name}</strong>
                  <span className="cr-body-text">{PROJECT_CATEGORY_LABELS[project.category]}</span>
                </div>
                <div className="cr-seats-bar" aria-label={`Avancement : ${String(project.progress)}%`}>
                  <div className="cr-seats-bar__fill" style={{ width: `${String(project.progress)}%` }} />
                </div>
                <p className="cr-body-text">
                  {project.progress}% — achèvement prévu {formatTurnPeriod(project.expectedCompletionTurn)}
                </p>
                <details className="cr-finance-block__details">
                  <summary>Détails</summary>
                  <div className="cr-finance-block__details-body">
                    <p>{project.description}</p>
                    {project.economicEffectsDuringConstruction.length > 0 ? (
                      <div>
                        <span className="cr-finance-block__details-label">Pendant la construction</span>
                        <ul>
                          {project.economicEffectsDuringConstruction.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {project.economicEffectsOnCompletion.length > 0 ? (
                      <div>
                        <span className="cr-finance-block__details-label">À l’achèvement</span>
                        <ul>
                          {project.economicEffectsOnCompletion.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <p className="cr-finance-block__provenance">Coût annuel : {formatMdFr(project.annualCost)}/an.</p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          {completed.length > 0 ? (
            <>
              <p className="cr-section-title">PROJETS ACHEVÉS</p>
              <ul className="cr-recap-list">
                {completed.map((project) => (
                  <li key={project.id} className="cr-report-row">
                    <span className="cr-report-row__label">{project.name}</span>
                    <span className="cr-report-row__value">Achevé</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}

const FUND_STRATEGY_LABELS: Record<SovereignFundStrategy, string> = {
  PRUDENT: 'PRUDENT',
  INDUSTRIAL: 'INDUSTRIEL',
  INNOVATION: 'INNOVATION',
  DIVERSIFIED: 'DIVERSIFIÉ',
}
const FUND_GOVERNANCE_LABELS: Record<SovereignFundGovernance, string> = {
  INDEPENDENT: 'INDÉPENDANTE',
  STATE_CONTROL: 'CONTRÔLE DE L’ÉTAT',
  MIXED: 'MIXTE',
}
const FUND_FUNDING_SOURCE_LABELS: Record<SovereignFundFundingSource, string> = {
  DEBT: 'DETTE',
  ASSET_SALES: 'CESSION D’ACTIFS',
  BUDGET_REALLOCATION: 'RÉALLOCATION BUDGÉTAIRE',
  HYBRID: 'HYBRIDE (DETTE + RÉALLOCATION)',
}

/** M6.5 Part IV: FONDS SOUVERAIN FRANCE isn't auto-created — a compact creation flow (tier/source/strategy/governance) when it doesn't exist yet, a dashboard once it does. */
function SovereignFundDetail({ fund, turn, dispatch }: { fund: SovereignFundState; turn: number; dispatch: (action: GameAction) => void }) {
  const [capitalization, setCapitalization] = useState<number>(SOVEREIGN_FUND_CAPITALIZATION_TIERS[1])
  const [fundingSource, setFundingSource] = useState<SovereignFundFundingSource>('HYBRID')
  const [strategy, setStrategy] = useState<SovereignFundStrategy>('DIVERSIFIED')
  const [governance, setGovernance] = useState<SovereignFundGovernance>('MIXED')

  if (!fund.exists) {
    return (
      <div className="cr-card">
        <h3 className="cr-section-title">FONDS SOUVERAIN FRANCE</h3>
        <p className="cr-body-text">
          Un fonds souverain n’est pas créé automatiquement — c’est une décision politique. Il investit un capital dédié selon une stratégie choisie, avec des risques et des retours réels (jamais d’argent gratuit).
        </p>
        <details className="cr-finance-block__details">
          <summary>Créer le fonds</summary>
          <div className="cr-finance-block__details-body">
            <div>
              <span className="cr-finance-block__details-label">Capitalisation</span>
              <div className="cr-level-toggle" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {SOVEREIGN_FUND_CAPITALIZATION_TIERS.map((tier) => (
                  <button key={tier} type="button" aria-pressed={capitalization === tier} onClick={() => { setCapitalization(tier) }}>
                    {formatMdFr(tier)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="cr-finance-block__details-label">Source de financement</span>
              <div className="cr-level-toggle" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {(Object.keys(FUND_FUNDING_SOURCE_LABELS) as SovereignFundFundingSource[]).map((source) => (
                  <button key={source} type="button" aria-pressed={fundingSource === source} onClick={() => { setFundingSource(source) }}>
                    {FUND_FUNDING_SOURCE_LABELS[source]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="cr-finance-block__details-label">Stratégie</span>
              <div className="cr-level-toggle" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {(Object.keys(FUND_STRATEGY_LABELS) as SovereignFundStrategy[]).map((s) => (
                  <button key={s} type="button" aria-pressed={strategy === s} onClick={() => { setStrategy(s) }}>
                    {FUND_STRATEGY_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="cr-finance-block__details-label">Gouvernance</span>
              <div className="cr-level-toggle" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {(Object.keys(FUND_GOVERNANCE_LABELS) as SovereignFundGovernance[]).map((g) => (
                  <button key={g} type="button" aria-pressed={governance === g} onClick={() => { setGovernance(g) }}>
                    {FUND_GOVERNANCE_LABELS[g]}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="cr-button cr-button--primary cr-button--small"
              onClick={() => { dispatch({ type: 'CREATE_SOVEREIGN_FUND', capitalization, fundingSource, strategy, governance }) }}
            >
              CRÉER LE FONDS — {formatMdFr(capitalization)}
            </button>
          </div>
        </details>
      </div>
    )
  }

  const transferable = maxTransferableDividend(fund)
  const netValue = netValueCreated(fund)
  const canRecap = canRecapitalize(fund, turn)

  return (
    <div className="cr-card">
      <h3 className="cr-section-title">FONDS SOUVERAIN FRANCE</h3>
      <div className="cr-indicator-grid">
        {[
          ['Capital apporté', formatMdFr(fund.capitalContributed)],
          ['Valeur du portefeuille', formatMdFr(fund.portfolioValue)],
          ['Rendement cumulé', formatSignedMdFr(fund.cumulativeReturn)],
          ['Dividendes versés à l’État', formatMdFr(fund.cumulativeDividendsToState)],
          ['Valeur nette créée', formatSignedMdFr(netValue)],
          ['Stratégie', FUND_STRATEGY_LABELS[fund.strategy]],
        ].map(([label, value]) => (
          <div className="cr-indicator" key={label}>
            <span className="cr-indicator__label">{label}</span>
            <span className="cr-indicator__value">{value}</span>
          </div>
        ))}
      </div>
      <details className="cr-finance-block__details">
        <summary>Portefeuille et actions</summary>
        <div className="cr-finance-block__details-body">
          <div>
            <span className="cr-finance-block__details-label">Composition du portefeuille</span>
            <ul>
              {fund.holdings.map((h) => (
                <li key={h.category}>
                  {h.category} — {formatPercent(h.share * 100, 0)}
                </li>
              ))}
            </ul>
          </div>
          <div className="cr-button-row">
            <button
              type="button"
              className="cr-button cr-button--secondary cr-button--small"
              disabled={transferable <= 0}
              onClick={() => { dispatch({ type: 'FUND_TRANSFER_DIVIDEND', amount: transferable }) }}
            >
              VERSER LE DIVIDENDE À L’ÉTAT ({formatMdFr(transferable)})
            </button>
          </div>
          <p className="cr-finance-block__provenance">
            {transferable > 0
              ? 'Le dividende non transféré reste réinvesti dans le portefeuille — le capital initial ne peut jamais être retiré comme un revenu.'
              : 'Aucun gain disponible à transférer pour l’instant — un fonds en perte n’a rien à distribuer.'}
          </p>
          <div className="cr-button-row">
            {SOVEREIGN_FUND_CAPITALIZATION_TIERS.slice(0, 2).map((amount) => (
              <button
                key={amount}
                type="button"
                className="cr-button cr-button--secondary cr-button--small"
                disabled={!canRecap}
                onClick={() => { dispatch({ type: 'RECAPITALIZE_FUND', amount }) }}
              >
                RECAPITALISER +{formatMdFr(amount)}
              </button>
            ))}
          </div>
          {!canRecap ? <p className="cr-finance-block__provenance">Une recapitalisation n’est possible que périodiquement, pas chaque année.</p> : null}
        </div>
      </details>
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

/** M6.5 Part V/§49: History now also lists resolved event choices — a follow-up episode (arcStage >= 2) is prefixed "CONSÉQUENCE DE [year]" naming the year its arc's OPENING choice was made, "only said when mechanically true" (never guessed). */
function HistoryDetail({
  billHistory,
  policyHistory,
  eventMemories,
}: {
  billHistory: BillHistoryEntry[]
  policyHistory: PolicyHistoryEntry[]
  eventMemories: readonly EventMemory[]
}) {
  type Entry = { turn: number; label: string; detail: string }
  const billEntries: Entry[] = billHistory.map((e) => ({ turn: e.turn, label: e.billTitle, detail: e.status }))
  const policyEntries: Entry[] = policyHistory.map((e) => ({ turn: e.turn, label: e.label, detail: e.amount !== undefined ? `${String(e.amount)} Md€/an` : '' }))
  const eventEntries: Entry[] = eventMemories.map((m) => {
    const event = getEventDefinition(m.eventId)
    const choice = event.choices.find((c) => c.id === m.choiceId)
    const isFollowUp = Boolean(event.arcId) && (event.arcStage ?? 1) > 1
    const originMemory = isFollowUp && event.arcId ? memoriesForArc(eventMemories, event.arcId)[0] : undefined
    const label = originMemory ? `Conséquence de ${String(turnToDate(originMemory.turn).startYear)} — ${event.title}` : event.title
    return { turn: m.turn, label, detail: choice?.title ?? '' }
  })
  const entries = [...billEntries, ...policyEntries, ...eventEntries].sort((a, b) => a.turn - b.turn)

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

/** M5 §60 / M6.5 Part VII: the read-only-except-fund-creation info views reachable from `NavBar` — Economy (+ investments + sovereign fund), Promises, Assembly, History. Rendered as a full-screen overlay over whatever mandate-loop screen is active; closing it never advances the simulation — `dispatch` here is used ONLY for the fund's own player-facing decisions (create/recapitalize/transfer dividend), each a deliberate action with its own button, never an implicit side effect of viewing the panel. */
export function DetailPanel({ tab, state, dispatch, onClose }: DetailPanelProps) {
  const promiseContext: PromiseEvaluationContext = {
    initialEconomic: state.initialEconomicSnapshot,
    currentEconomic: state.gameState.economic,
    currentTurn: state.gameState.meta.turn,
    policyHistory: state.policyHistory,
    serviceIndices: state.serviceIndices,
  }

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--secondary cr-button--small" onClick={onClose}>
            ← RETOUR
          </button>
        </div>

        {tab === 'economy' ? (
          <>
            <EconomyDetail economic={state.gameState.economic} />
            <ProjectsDetail projects={state.projects} />
            <SovereignFundDetail fund={state.sovereignFund} turn={state.gameState.meta.turn} dispatch={dispatch} />
          </>
        ) : null}
        {tab === 'promises' ? <PromiseTracker selectedPromiseIds={state.choices.selectedPromiseIds} context={promiseContext} resolutions={state.promiseResolutions} /> : null}
        {tab === 'assembly' && state.parliamentComposition ? (
          <AssemblyDetail composition={state.parliamentComposition} blocRelations={state.blocRelations} />
        ) : null}
        {tab === 'history' ? <HistoryDetail billHistory={state.billHistory} policyHistory={state.policyHistory} eventMemories={state.eventMemories} /> : null}
      </div>
    </div>
  )
}
