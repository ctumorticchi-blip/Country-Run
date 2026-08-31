import type { EconomicState, GameMeta, PoliticalState } from '../../engine/state/gameState.ts'
import type { DecisionConfig } from '../../game/country-run/prototype/types.ts'
import { DecisionCard } from '../components/DecisionCard.tsx'
import { EconomicDashboard } from '../components/EconomicDashboard.tsx'

interface DecisionScreenProps {
  decision: DecisionConfig
  economic: EconomicState
  political: Pick<PoliticalState, 'popularity'>
  meta: Pick<GameMeta, 'year' | 'month'>
  onChoose: (choiceId: string) => void
}

/** Generic screen shell for a one-decision moment, with the persistent dashboard on top (M2 §7-8). */
export function DecisionScreen({ decision, economic, political, meta, onChoose }: DecisionScreenProps) {
  return (
    <div className="cr-screen">
      <div className="cr-page">
        <EconomicDashboard economic={economic} political={political} meta={meta} periodLabel="Année 1" />
        <DecisionCard decision={decision} onChoose={onChoose} />
      </div>
    </div>
  )
}
