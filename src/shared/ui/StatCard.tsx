interface StatCardProps {
  label: string
  value: string
}

/** A minimal labeled value tile, reused across the debug shell. */
export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
    </div>
  )
}
