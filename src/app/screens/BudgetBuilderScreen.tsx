import { useMemo } from 'react'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from '../../engine/economy/config/defaultConfig.ts'
import type { EconomicPolicyInput, WorldState } from '../../engine/economy/types.ts'
import type { EconomicState, GameState } from '../../engine/state/gameState.ts'
import { forecastNextYear } from '../../game/country-run/finance/budgetForecast.ts'
import { computeFinanceChanges, prospectivePolicyForDraft } from '../../game/country-run/finance/financeEffects.ts'
import type { RevenueBlockId, SpendingBlockId } from '../../game/country-run/finance/financeTypes.ts'
import { REVENUE_BLOCK_ORDER, REVENUE_BLOCKS } from '../../game/country-run/finance/revenueBlocks.ts'
import { SPENDING_BLOCK_ORDER, SPENDING_BLOCKS } from '../../game/country-run/finance/spendingBlocks.ts'
import { deriveGovernmentEngineConfig, fiscalEstimateRangeWidth } from '../../game/country-run/government/governmentEffects.ts'
import { getGovernmentProfile } from '../../game/country-run/government/governmentProfiles.ts'
import { FinanceBlockCard } from '../components/FinanceBlockCard.tsx'
import { BudgetSummary } from '../components/BudgetSummary.tsx'
import { formatMdFr } from '../format.ts'
import type { FinanceSelectionState } from '../gameReducer.ts'

interface BudgetBuilderScreenProps {
  economic: EconomicState
  gameState: GameState
  worldState: WorldState
  seed: string
  lastMergedPolicyInput: EconomicPolicyInput
  governmentProfileId: string
  budgetLabel: string
  financeLevels: FinanceSelectionState
  draftSelections: FinanceSelectionState
  selectedPromiseIds: readonly string[]
  onChangeSpendingTier: (blockId: SpendingBlockId, tierId: string) => void
  onChangeRevenueTier: (blockId: RevenueBlockId, tierId: string) => void
  onSubmit: () => void
}

const GLOSSARY: [string, string][] = [
  ['PIB', 'Produit intérieur brut — la richesse totale produite par le pays en un an.'],
  ['Déficit', 'Ce que l’État dépense en plus de ce qu’il perçoit, sur un an.'],
  ['Dette', 'La somme cumulée de tous les déficits passés, non remboursés.'],
  ['Solde primaire', 'Solde avant paiement des intérêts de la dette — ce que le budget "de base" dégage.'],
  ['Charge de la dette', 'Les intérêts versés chaque année aux créanciers de l’État.'],
  ['Prélèvements obligatoires', 'Impôts, taxes et cotisations sociales perçus par l’État.'],
  ['Croissance nominale', 'Croissance du PIB en valeur, avant déduction de l’inflation.'],
]

/** M6 §60-66: HEADER (macro situation) / REVENUE (4 cards) / SPENDING (9 cards) / DEBT (locked) / sticky NOTE DE BERCY summary — progressive disclosure throughout so the screen stays playable on a 390px phone. */
export function BudgetBuilderScreen({
  economic,
  gameState,
  worldState,
  seed,
  lastMergedPolicyInput,
  governmentProfileId,
  budgetLabel,
  financeLevels,
  draftSelections,
  selectedPromiseIds,
  onChangeSpendingTier,
  onChangeRevenueTier,
  onSubmit,
}: BudgetBuilderScreenProps) {
  const changes = useMemo(
    () => computeFinanceChanges(draftSelections.spending, financeLevels.spending, draftSelections.revenue, financeLevels.revenue),
    [draftSelections, financeLevels],
  )

  // M6.1 §8-10: the LIVE "PRÉVISION DE BERCY" — a PURE read, recomputed whenever the draft changes.
  // Never dispatches, never touches real game state/RNG/ledger/promise history (see financeEffects.ts's
  // `prospectivePolicyForDraft` and budgetForecast.ts's own module doc for the purity guarantees).
  const forecast = useMemo(() => {
    const modifiers = getGovernmentProfile(governmentProfileId).modifiers
    const engineConfig = deriveGovernmentEngineConfig(DEFAULT_ECONOMIC_ENGINE_CONFIG, modifiers)
    const widthMultiplier = fiscalEstimateRangeWidth(1, modifiers)
    const prospectivePolicy = prospectivePolicyForDraft(lastMergedPolicyInput, changes)
    return forecastNextYear(gameState, worldState, engineConfig, prospectivePolicy, lastMergedPolicyInput, seed, widthMultiplier)
  }, [changes, gameState, worldState, seed, lastMergedPolicyInput, governmentProfileId])

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">Budget</p>
          <h1 className="cr-title">{budgetLabel.toUpperCase()}</h1>
          <p className="cr-body-text">Chaque milliard dépensé doit être financé. Chaque économie a des conséquences.</p>
        </div>

        <div className="cr-budget-header">
          <div className="cr-card">
            <div className="cr-body-text">Recettes actuelles</div>
            <strong>{formatMdFr(economic.publicRevenue)}</strong>
          </div>
          <div className="cr-card">
            <div className="cr-body-text">Dépenses actuelles</div>
            <strong>{formatMdFr(economic.publicSpending)}</strong>
          </div>
          <div className="cr-card">
            <div className="cr-body-text">Déficit actuel</div>
            <strong>{economic.deficitRatio.toFixed(1)}% du PIB</strong>
          </div>
          <div className="cr-card">
            <div className="cr-body-text">Charge de la dette (verrouillée)</div>
            <strong>{formatMdFr(economic.interestCost)}</strong>
          </div>
        </div>

        <section>
          <h2 className="cr-section-title">RECETTES</h2>
          {REVENUE_BLOCK_ORDER.map((blockId) => (
            <FinanceBlockCard
              key={blockId}
              block={REVENUE_BLOCKS[blockId]}
              selectedTierId={draftSelections.revenue[blockId]}
              enactedTierId={financeLevels.revenue[blockId]}
              onChange={(tierId) => { onChangeRevenueTier(blockId, tierId) }}
            />
          ))}
        </section>

        <section>
          <h2 className="cr-section-title">DÉPENSES</h2>
          {SPENDING_BLOCK_ORDER.map((blockId) => (
            <FinanceBlockCard
              key={blockId}
              block={SPENDING_BLOCKS[blockId]}
              selectedTierId={draftSelections.spending[blockId]}
              enactedTierId={financeLevels.spending[blockId]}
              onChange={(tierId) => { onChangeSpendingTier(blockId, tierId) }}
            />
          ))}
          <div className="cr-card cr-finance-block cr-finance-block--locked">
            <div className="cr-finance-block__head">
              <strong>Charge de la dette</strong>
              <span className="cr-body-text">{formatMdFr(economic.interestCost)}/an</span>
            </div>
            <p className="cr-budget-category__copy">
              Calculée automatiquement chaque année à partir du stock de dette et du taux d’intérêt effectif — jamais choisie directement par le président.
            </p>
          </div>
        </section>

        <BudgetSummary economic={economic} changes={changes} selectedPromiseIds={selectedPromiseIds} forecast={forecast} />

        <details className="cr-glossary">
          <summary>Glossaire</summary>
          <dl>
            {GLOSSARY.map(([term, definition]) => (
              <div key={term} className="cr-glossary__row">
                <dt>{term}</dt>
                <dd>{definition}</dd>
              </div>
            ))}
          </dl>
        </details>

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onSubmit}>
            SOUMETTRE LE BUDGET AU PARLEMENT
          </button>
        </div>
      </div>
    </div>
  )
}
