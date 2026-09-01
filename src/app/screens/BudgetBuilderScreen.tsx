import { BUDGET_CATEGORIES, BUDGET_CATEGORY_ORDER } from '../../game/country-run/budget/budgetCategories.ts'
import { estimateBudgetImpact, selectionsToLevels } from '../../game/country-run/budget/budgetEffects.ts'
import type { BudgetCategoryId, BudgetLevels, BudgetSelections } from '../../game/country-run/budget/budgetTypes.ts'
import type { EconomicState } from '../../engine/state/gameState.ts'
import { BudgetCategoryCard } from '../components/BudgetCategoryCard.tsx'
import { BudgetSummary } from '../components/BudgetSummary.tsx'

interface BudgetBuilderScreenProps {
  economic: EconomicState
  budgetLabel: string
  selections: BudgetSelections
  previousLevels: BudgetLevels
  onChangeTier: (category: BudgetCategoryId, tierId: string) => void
  onSubmit: () => void
}

export function BudgetBuilderScreen({ economic, budgetLabel, selections, previousLevels, onChangeTier, onSubmit }: BudgetBuilderScreenProps) {
  const estimate = estimateBudgetImpact(selectionsToLevels(selections), previousLevels, economic.gdp)

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
            <div className="cr-body-text">Recettes projetées</div>
            <strong>{economic.publicRevenue.toFixed(0)} Md€</strong>
          </div>
          <div className="cr-card">
            <div className="cr-body-text">Dépenses projetées</div>
            <strong>{economic.publicSpending.toFixed(0)} Md€</strong>
          </div>
          <div className="cr-card">
            <div className="cr-body-text">Déficit projeté</div>
            <strong>{economic.deficitRatio.toFixed(1)}% du PIB</strong>
          </div>
        </div>

        {BUDGET_CATEGORY_ORDER.map((categoryId) => (
          <BudgetCategoryCard
            key={categoryId}
            category={BUDGET_CATEGORIES[categoryId]}
            tierId={selections[categoryId]}
            onChange={(tierId) => { onChangeTier(categoryId, tierId) }}
          />
        ))}

        <BudgetSummary
          estimate={estimate}
          projectedRevenue={economic.publicRevenue}
          projectedSpending={economic.publicSpending}
          projectedDeficitRatio={economic.deficitRatio}
        />

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onSubmit}>
            SOUMETTRE LE BUDGET AU PARLEMENT
          </button>
        </div>
      </div>
    </div>
  )
}
