import type { BudgetCategoryConfig } from '../../game/country-run/budget/budgetTypes.ts'
import { formatSigned } from '../format.ts'

interface BudgetCategoryCardProps {
  category: BudgetCategoryConfig
  tierId: string
  onChange: (tierId: string) => void
}

export function BudgetCategoryCard({ category, tierId, onChange }: BudgetCategoryCardProps) {
  return (
    <div className="cr-card cr-budget-category">
      <div className="cr-budget-category__head">
        <strong>{category.label}</strong>
        <span className="cr-body-text">{category.baseline} Md€/an</span>
      </div>

      <div className="cr-level-toggle" role="group" aria-label={`Budget ${category.label}`}>
        {category.tiers.map((tier) => (
          <button key={tier.id} type="button" aria-pressed={tierId === tier.id} onClick={() => { onChange(tier.id) }}>
            {tier.label}
            <br />
            {formatSigned(tier.value, 0, ' Md€')}
          </button>
        ))}
      </div>

      <p className="cr-budget-category__copy">{category.tiers.find((t) => t.id === tierId)?.copy}</p>
    </div>
  )
}
