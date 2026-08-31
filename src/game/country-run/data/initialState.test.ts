import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState.ts'

describe('createInitialGameState', () => {
  it('starts at turn 0 with the given seed, in the setup phase', () => {
    const state = createInitialGameState('my-seed')
    expect(state.meta.turn).toBe(0)
    expect(state.meta.seed).toBe('my-seed')
    expect(state.meta.phase).toBe('setup')
  })

  it('starts with no active policies and no delayed effects queued', () => {
    const state = createInitialGameState('my-seed')
    expect(state.policy.activePolicies).toEqual([])
    expect(state.delayedEffects).toEqual([])
  })

  it('produces an independent state object on every call', () => {
    const a = createInitialGameState('my-seed')
    const b = createInitialGameState('my-seed')
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(a.policy.activePolicies).not.toBe(b.policy.activePolicies)
  })
})
