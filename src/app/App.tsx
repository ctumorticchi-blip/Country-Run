import { StatCard } from '../shared/ui/StatCard.tsx'
import { useGameSession } from './useGameSession.ts'
import './App.css'

/**
 * M0 debug shell: displays core state and lets you drive the turn engine.
 * Not a real UI — see docs/ARCHITECTURE.md for what's explicitly out of
 * scope for M0.
 */
export function App() {
  const { state, advanceTurn, reset } = useGameSession()

  return (
    <main className="debug-shell">
      <h1>Country Run</h1>
      <p className="debug-shell__meta">
        seed <code>{state.meta.seed}</code> — turn {state.meta.turn} — {state.meta.year}/
        {String(state.meta.month).padStart(2, '0')} — phase: {state.meta.phase}
      </p>

      <div className="stat-grid">
        <StatCard label="GDP (Md€)" value={state.economic.gdp.toFixed(1)} />
        <StatCard label="Growth" value={`${state.economic.growth.toFixed(1)}%`} />
        <StatCard label="Unemployment" value={`${state.economic.unemployment.toFixed(1)}%`} />
        <StatCard label="Inflation" value={`${state.economic.inflation.toFixed(1)}%`} />
        <StatCard label="Deficit (% GDP)" value={`${state.economic.deficitRatio.toFixed(1)}%`} />
        <StatCard label="Debt (% GDP)" value={`${state.economic.debtRatio.toFixed(1)}%`} />
        <StatCard label="Popularity" value={`${state.political.popularity.toFixed(0)}%`} />
        <StatCard label="Social tension" value={state.social.socialTension.toFixed(0)} />
      </div>

      <div className="debug-shell__actions">
        <button type="button" onClick={advanceTurn}>
          Advance Turn
        </button>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>
    </main>
  )
}
