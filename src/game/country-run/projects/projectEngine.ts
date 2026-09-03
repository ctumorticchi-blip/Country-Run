import { createActionRng } from '../prototype/rng.ts'
import { getProjectTemplate, PROJECT_CATALOG, type NationalProjectTemplate } from './projectCatalog.ts'
import type { NationalProject } from './projectTypes.ts'

/**
 * M6.5 §28: launches a new `NationalProject` instance from its catalog
 * template. `totalCost`/`annualCost` are simply the triggering bill's own
 * `fiscalCost` (display only — see `projectTypes.ts`'s module doc for why
 * this can never double-count). The completion turn has a small,
 * SEEDED (never `Math.random`) jitter around `typicalDurationTurns` —
 * "do not make every project take exactly the same time" (§28) while
 * staying fully deterministic for the same seed+turn+project.
 */
export function launchProject(templateId: string, launchTurn: number, fiscalCost: number, seed: string, source: string): NationalProject {
  const template = getProjectTemplate(templateId)
  const rng = createActionRng(seed, `project-launch-${templateId}-turn-${String(launchTurn)}`)
  // ±20% duration jitter, at least 1 turn different from the template's typical duration is possible either way.
  const jitterTurns = Math.round(template.typicalDurationTurns * rng.float(-0.2, 0.2))
  const durationTurns = Math.max(4, template.typicalDurationTurns + jitterTurns)

  return {
    id: `${templateId}:turn-${String(launchTurn)}`,
    catalogId: templateId,
    name: template.name,
    category: template.category,
    description: template.description,
    totalCost: Math.abs(fiscalCost) * (durationTurns / 6),
    annualCost: Math.abs(fiscalCost),
    startTurn: launchTurn,
    expectedCompletionTurn: launchTurn + durationTurns,
    progress: 0,
    status: 'UNDER_CONSTRUCTION',
    economicEffectsDuringConstruction: template.economicEffectsDuringConstruction,
    economicEffectsOnCompletion: template.economicEffectsOnCompletion,
    serviceEffectsOnCompletion: template.serviceEffectsOnCompletion,
    riskTags: template.riskTags,
    eventTags: template.eventTags,
    source,
  }
}

/** Every catalog template not already launched this run — a project can only ever be built once per mandate. */
export function availableProjectTemplates(projects: readonly NationalProject[]): NationalProjectTemplate[] {
  const launchedCatalogIds = new Set(projects.map((p) => p.catalogId))
  return PROJECT_CATALOG.filter((t) => !launchedCatalogIds.has(t.id))
}

/** M6.5 §26: a bill's adoption may launch a project — `null` if this bill has no matching, not-yet-launched template. */
export function projectTemplateForBill(billId: string, projects: readonly NationalProject[]): NationalProjectTemplate | null {
  const available = availableProjectTemplates(projects)
  return available.find((t) => t.trigger.kind === 'bill' && t.trigger.billId === billId) ?? null
}

/** M6.5 §26: an event choice may launch a project — `null` if no match or already launched. */
export function projectTemplateForEventChoice(eventId: string, choiceId: string, projects: readonly NationalProject[]): NationalProjectTemplate | null {
  const available = availableProjectTemplates(projects)
  return available.find((t) => t.trigger.kind === 'event' && t.trigger.eventId === eventId && t.trigger.choiceId === choiceId) ?? null
}

/** M6.5 §26: adopting a specific budget tier may launch a project — `null` if no match or already launched. */
export function projectTemplateForFinanceTier(blockId: string, tierId: string, projects: readonly NationalProject[]): NationalProjectTemplate | null {
  const available = availableProjectTemplates(projects)
  return available.find((t) => t.trigger.kind === 'financeTier' && t.trigger.blockId === blockId && t.trigger.tierId === tierId) ?? null
}

export interface AdvanceProjectsResult {
  projects: NationalProject[]
  justCompleted: NationalProject[]
}

/**
 * M6.5 §28: advances every UNDER_CONSTRUCTION project's `progress` for the
 * turn just played, marking COMPLETED once it reaches 100. Linear against
 * `expectedCompletionTurn` (itself already seeded-jittered per project at
 * `launchProject` time — see its own doc comment for "not every project
 * takes exactly the same time") — deliberately monotonic turn to turn
 * (a progress bar that could regress would read as a bug, not a feature).
 */
export function advanceProjects(projects: readonly NationalProject[], turn: number): AdvanceProjectsResult {
  const justCompleted: NationalProject[] = []
  const next = projects.map((project) => {
    if (project.status !== 'UNDER_CONSTRUCTION') return project
    const totalDuration = project.expectedCompletionTurn - project.startTurn
    const elapsed = turn - project.startTurn
    const progress = Math.round(Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)))

    if (progress >= 100 || turn >= project.expectedCompletionTurn) {
      const completed: NationalProject = { ...project, progress: 100, status: 'COMPLETED' }
      justCompleted.push(completed)
      return completed
    }
    return { ...project, progress }
  })
  return { projects: next, justCompleted }
}
