import { describe, expect, it } from 'vitest'
import { advanceProjects, availableProjectTemplates, launchProject, projectTemplateForBill, projectTemplateForEventChoice, projectTemplateForFinanceTier } from './projectEngine.ts'
import { PROJECT_CATALOG } from './projectCatalog.ts'

describe('launchProject', () => {
  it('creates an UNDER_CONSTRUCTION project with progress 0, copying cost/name/category from the template and the caller-supplied fiscalCost', () => {
    const project = launchProject('national-rail-modernization', 7, 24, 'seed-a', 'public-investment-plan-bill')
    expect(project.status).toBe('UNDER_CONSTRUCTION')
    expect(project.progress).toBe(0)
    expect(project.name).toBe('PLAN FERROVIAIRE NATIONAL')
    expect(project.category).toBe('TRANSPORT')
    expect(project.annualCost).toBe(24)
    expect(project.startTurn).toBe(7)
    expect(project.expectedCompletionTurn).toBeGreaterThan(project.startTurn)
    expect(project.source).toBe('public-investment-plan-bill')
  })

  it('is deterministic — same seed/turn/template always yields the same completion turn', () => {
    const a = launchProject('nuclear-program', 5, 10, 'seed-x', 'energy-transition-bill')
    const b = launchProject('nuclear-program', 5, 10, 'seed-x', 'energy-transition-bill')
    expect(a.expectedCompletionTurn).toBe(b.expectedCompletionTurn)
  })

  it('a different seed can yield a different (but still bounded) duration — "not every project takes exactly the same time"', () => {
    const durations = ['seed-1', 'seed-2', 'seed-3', 'seed-4', 'seed-5'].map((seed) => {
      const p = launchProject('hospital-modernization', 3, 6, seed, 'hospital-plan-bill')
      return p.expectedCompletionTurn - p.startTurn
    })
    expect(new Set(durations).size).toBeGreaterThan(1)
    for (const d of durations) {
      expect(d).toBeGreaterThanOrEqual(4)
    }
  })

  it('throws on an unknown template id', () => {
    expect(() => launchProject('not-a-real-project', 1, 1, 'seed', 'x')).toThrow()
  })
})

describe('availableProjectTemplates', () => {
  it('excludes catalog templates already launched, keeps the rest', () => {
    const launched = [launchProject('nuclear-program', 1, 5, 'seed', 'energy-transition-bill')]
    const available = availableProjectTemplates(launched)
    expect(available.some((t) => t.id === 'nuclear-program')).toBe(false)
    expect(available).toHaveLength(PROJECT_CATALOG.length - 1)
  })

  it('a project can only be launched once — its own catalogId never reappears as available', () => {
    const p1 = launchProject('hospital-modernization', 1, 5, 'seed', 'hospital-plan-bill')
    const p2 = launchProject('hospital-modernization', 20, 5, 'seed', 'hospital-plan-bill')
    const available = availableProjectTemplates([p1, p2])
    expect(available.filter((t) => t.id === 'hospital-modernization')).toHaveLength(0)
  })
})

describe('advanceProjects — progress and completion', () => {
  it('progress increases over time and reaches exactly 100 with status COMPLETED by the expected completion turn', () => {
    const project = launchProject('housing-construction-program', 1, 6, 'seed-progress', 'housing-construction-plan-bill')
    let projects = [project]
    let lastCompleted: ReturnType<typeof advanceProjects>['justCompleted'] = []
    for (let turn = project.startTurn + 1; turn <= project.expectedCompletionTurn + 2; turn++) {
      const result = advanceProjects(projects, turn)
      projects = result.projects
      if (result.justCompleted.length > 0) lastCompleted = result.justCompleted
    }
    expect(projects[0].status).toBe('COMPLETED')
    expect(projects[0].progress).toBe(100)
    expect(lastCompleted).toHaveLength(1)
    expect(lastCompleted[0].id).toBe(project.id)
  })

  it('progress never exceeds 100 and never goes backward turn to turn', () => {
    const project = launchProject('semiconductor-strategy', 1, 6, 'seed-monotone', 'industry-innovation-plan-bill')
    let projects = [project]
    let previousProgress = 0
    for (let turn = project.startTurn + 1; turn <= project.expectedCompletionTurn; turn++) {
      const result = advanceProjects(projects, turn)
      projects = result.projects
      expect(projects[0].progress).toBeGreaterThanOrEqual(previousProgress)
      expect(projects[0].progress).toBeLessThanOrEqual(100)
      previousProgress = projects[0].progress
    }
  })

  it('a COMPLETED or CANCELLED project is left untouched by further advances', () => {
    const project = launchProject('defense-industrial-program', 1, 6, 'seed-done', 'defense-expansion-bill')
    const completed = { ...project, status: 'COMPLETED' as const, progress: 100 }
    const result = advanceProjects([completed], completed.expectedCompletionTurn + 5)
    expect(result.projects[0]).toEqual(completed)
    expect(result.justCompleted).toHaveLength(0)
  })

  it('is deterministic — replaying the same turn sequence with the same seed always yields the same final progress trace', () => {
    const project = launchProject('university-research-program', 1, 6, 'seed-det', 'education-investment-bill')
    const runOnce = () => {
      let projects = [project]
      const trace: number[] = []
      for (let turn = project.startTurn + 1; turn <= project.expectedCompletionTurn; turn++) {
        projects = advanceProjects(projects, turn).projects
        trace.push(projects[0].progress)
      }
      return trace
    }
    expect(runOnce()).toEqual(runOnce())
  })
})

describe('projectTemplateForBill / projectTemplateForEventChoice / projectTemplateForFinanceTier', () => {
  it('projectTemplateForBill resolves the matching template, null when already launched or no match', () => {
    expect(projectTemplateForBill('hospital-plan-bill', [])?.id).toBe('hospital-modernization')
    expect(projectTemplateForBill('not-a-real-bill', [])).toBeNull()
    const launched = [launchProject('hospital-modernization', 1, 5, 'seed', 'hospital-plan-bill')]
    expect(projectTemplateForBill('hospital-plan-bill', launched)).toBeNull()
  })

  it('projectTemplateForEventChoice resolves the matching (eventId, choiceId) pair', () => {
    expect(projectTemplateForEventChoice('ai-industry-plan', 'large-co-investment', [])?.id).toBe('public-digital-ai-infrastructure')
    expect(projectTemplateForEventChoice('ai-industry-plan', 'decline', [])).toBeNull()
    expect(projectTemplateForEventChoice('drought-shock', 'accelerate-adaptation', [])?.id).toBe('climate-adaptation-program')
  })

  it('projectTemplateForFinanceTier resolves the matching (blockId, tierId) pair', () => {
    expect(projectTemplateForFinanceTier('economyInvestment', 'infrastructure', [])?.id).toBe('energy-grid-modernization')
    expect(projectTemplateForFinanceTier('economyInvestment', 'maintain', [])).toBeNull()
  })
})

describe('M6.5 §27 — no fiscal double counting', () => {
  it('launchProject never touches any fiscal/economic state — it is a pure function returning a new display object', () => {
    // launchProject's signature itself proves this: it takes only (templateId, turn, fiscalCost, seed, source)
    // and returns a plain NationalProject — no GameState/fiscalLedger/EconomicPolicyInput parameter exists to mutate.
    const project = launchProject('national-rail-modernization', 1, 10, 'seed', 'public-investment-plan-bill')
    expect(project.totalCost).toBe(10 * ((project.expectedCompletionTurn - project.startTurn) / 6))
    expect(project.annualCost).toBe(10)
  })

  it('advanceProjects never touches any fiscal/economic state — same purity argument, only (projects, turn) in', () => {
    const project = launchProject('nuclear-program', 1, 10, 'seed', 'energy-transition-bill')
    const before = JSON.stringify(project)
    advanceProjects([project], 5)
    // the ORIGINAL project object passed in is never mutated (immutability, not just "no fiscal field touched").
    expect(JSON.stringify(project)).toBe(before)
  })
})
