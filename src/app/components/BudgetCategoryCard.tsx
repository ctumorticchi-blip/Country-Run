import type { BudgetCategoryConfig, BudgetLevel } from '../../game/country-run/budget/budgetTypes.ts'
import { formatSigned } from '../format.ts'

const LEVEL_LABEL: Record<BudgetLevel, string> = { cut: 'Économies', maintain: 'Maintien', invest: 'Investir' }

interface BudgetCategoryCardProps {
  category: BudgetCategoryConfig
  level: BudgetLevel
  onChange: (level: BudgetLevel) => void
}

export function BudgetCategoryCard({ category, level, onChange }: BudgetCategoryCardProps) {
  return (
    <div className="cr-card cr-budget-category">
      <div className="cr-budget-category__head">
        <strong>{category.label}</strong>
        <span className="cr-body-text">{category.baseline} Md€/an</span>
      </div>

      <div className="cr-level-toggle" role="group" aria-label={`Budget ${category.label}`}>
        {(['cut', 'maintain', 'invest'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={level === candidate}
            onClick={() => { onChange(candidate) }}
          >
            {LEVEL_LABEL[candidate]}
            <br />
            {formatSigned(category.levels[candidate], 0, ' Md€')}
          </button>
        ))}
      </div>

      <p className="cr-budget-category__copy">{category.copy[level]}</p>
    </div>
  )
}
