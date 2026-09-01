export type NavTab = 'economy' | 'promises' | 'assembly' | 'history'

interface NavBarProps {
  activeTab: NavTab | null
  onSelect: (tab: NavTab) => void
}

const TABS: { id: NavTab; label: string }[] = [
  { id: 'economy', label: 'ÉCONOMIE' },
  { id: 'promises', label: 'PROMESSES' },
  { id: 'assembly', label: 'ASSEMBLÉE' },
  { id: 'history', label: 'HISTORIQUE' },
]

/** M5 §60: compact persistent navigation to the read-only Economy/Promises/Assembly/History detail views — every in-game ACTION stays contextual to its own screen; this nav never itself advances the simulation. */
export function NavBar({ activeTab, onSelect }: NavBarProps) {
  return (
    <nav className="cr-navbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`cr-navbar__item ${activeTab === tab.id ? 'cr-navbar__item--active' : ''}`}
          onClick={() => { onSelect(tab.id) }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
