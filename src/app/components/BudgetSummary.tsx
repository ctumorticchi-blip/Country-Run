import { computeBudgetEquation, debtInterestShareOfSpending, type FinanceBlockChange } from '../../game/country-run/finance/financeEffects.ts'
import { computeDebtStabilization, computePrimaryBalance } from '../../game/country-run/finance/primaryBalance.ts'
import type { EconomicState } from '../../engine/state/gameState.ts'
import { formatMdFr, formatPercentFr, formatSignedMdFr } from '../format.ts'

interface BudgetSummaryProps {
  economic: EconomicState
  changes: FinanceBlockChange[]
  selectedPromiseIds: readonly string[]
}

/**
 * M6 §34: "NOTE DE BERCY" — the annual budget's sticky summary, always
 * visible while drafting. Neutral tone throughout (M6's explicit
 * instruction: never "good budget"/"bad budget"). Every number here is
 * either read straight from the real simulated `EconomicState`
 * (`computeBudgetEquation`/`computePrimaryBalance`/`computeDebtStabilization`,
 * never re-derived from the block breakdown) or the draft's own declared
 * `annualFiscalDelta`/`riskDescription`/`promiseLinks` — no invented
 * numbers, no fake single-point forecast (a full pure forward-simulated
 * forecast exists in `finance/budgetForecast.ts` but is not wired into
 * this live-editing view — see docs/ECONOMY_BUDGET_M6.md's "known
 * limitations").
 */
export function BudgetSummary({ economic, changes, selectedPromiseIds }: BudgetSummaryProps) {
  const equation = computeBudgetEquation(economic)
  const primaryBalance = computePrimaryBalance(economic)
  const stabilization = computeDebtStabilization(economic)
  const netStructuralChange = changes.reduce((sum, c) => sum + c.fiscalChange, 0)
  const risks = changes.filter((c) => c.riskDescription).map((c) => c.riskDescription as string)
  const promiseImpacts = changes.filter((c) => c.promiseLinks && c.promiseLinks.some((id) => selectedPromiseIds.includes(id)))

  return (
    <div className="cr-summary">
      <strong>NOTE DE BERCY — VOTRE BUDGET</strong>

      <dl style={{ margin: 0 }}>
        <div className="cr-summary__row">
          <dt>Recettes</dt>
          <dd>{formatMdFr(equation.revenueBn)} ({formatPercentFr(equation.revenuePctGdp)} PIB)</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Dépenses</dt>
          <dd>{formatMdFr(equation.spendingBn)} ({formatPercentFr(equation.spendingPctGdp)} PIB)</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Solde</dt>
          <dd>{formatSignedMdFr(equation.balanceBn)} (déficit {formatPercentFr(equation.deficitRatio)} PIB)</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Solde primaire (hors charge de la dette)</dt>
          <dd>{formatSignedMdFr(primaryBalance.primaryBalanceBn)}</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Charge de la dette</dt>
          <dd>{formatMdFr(economic.interestCost)} ({formatPercentFr(debtInterestShareOfSpending(economic))} des dépenses)</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Effort pour stabiliser la dette</dt>
          <dd>{stabilization.gap > 0 ? `${formatPercentFr(stabilization.gap)} PIB restant à trouver` : 'Dette déjà en trajectoire de stabilisation'}</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Changement structurel net vs politique actuelle</dt>
          <dd>{formatSignedMdFr(netStructuralChange)}/an</dd>
        </div>
      </dl>

      {risks.length > 0 ? (
        <div className="cr-warning-banner">
          <strong>PRINCIPAUX RISQUES</strong>
          <ul>{risks.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      ) : null}

      {promiseImpacts.length > 0 ? (
        <div>
          <strong>IMPACT SUR VOS ENGAGEMENTS</strong>
          <ul className="cr-preview-list">
            {promiseImpacts.map((c) => (
              <li key={`${c.kind}-${c.blockId}`}>{c.blockLabel} — {c.newTierLabel}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
