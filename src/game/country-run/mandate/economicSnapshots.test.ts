import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../data/initialState.ts'
import { MAX_SNAPSHOTS, recordSnapshot, snapshotFrom } from './economicSnapshots.ts'

const economic = createInitialGameState('snapshot-test-seed').economic

describe('snapshotFrom (M5 §65)', () => {
  it('captures only the curated subset of indicators, plus popularity', () => {
    const snapshot = snapshotFrom(3, economic, 55)
    expect(snapshot).toEqual({
      turn: 3,
      growth: economic.growth,
      unemployment: economic.unemployment,
      inflation: economic.inflation,
      deficitRatio: economic.deficitRatio,
      debtRatio: economic.debtRatio,
      purchasingPower: economic.purchasingPower,
      popularity: 55,
    })
  })
})

describe('recordSnapshot', () => {
  it('appends without dropping while at or under the cap', () => {
    let history = recordSnapshot([], snapshotFrom(1, economic, 50))
    history = recordSnapshot(history, snapshotFrom(2, economic, 50))
    expect(history).toHaveLength(2)
    expect(history.map((s) => s.turn)).toEqual([1, 2])
  })

  it('drops the oldest snapshot once past MAX_SNAPSHOTS, keeping exactly MAX_SNAPSHOTS entries', () => {
    let history: ReturnType<typeof recordSnapshot> = []
    for (let turn = 1; turn <= MAX_SNAPSHOTS + 5; turn++) {
      history = recordSnapshot(history, snapshotFrom(turn, economic, 50))
    }
    expect(history).toHaveLength(MAX_SNAPSHOTS)
    expect(history[0].turn).toBe(6) // turns 1-5 dropped
    expect(history[history.length - 1].turn).toBe(MAX_SNAPSHOTS + 5)
  })
})
