// App state machine — booth spec §3. useReducer, no external store.

import { useReducer } from 'react'
import { carFromDeviceId, driverHandle, type CarSpec } from '../game/cars'
import type { LeaderboardEntry } from '../net/relay'

export type Screen =
  | 'boot'
  | 'reveal'
  | 'garage'
  | 'plugging' // transient; garage owns the gesture, kept for spec parity
  | 'handshake'
  | 'charging'
  | 'results'
  | 'leaderboard'

export interface RunResult {
  whCharged: number
  whDischarged: number
  monPaid: number
  monEarned: number
  score: number
  tapCount: number
  flipped: boolean
  rank: number | null
  top: LeaderboardEntry[] | null
}

export interface AppState {
  screen: Screen
  deviceId: string
  nickname: string
  car: CarSpec
  seenReveal: boolean
  lastRun: RunResult | null
  bestScore: number
}

export type Action =
  | { type: 'go'; screen: Screen }
  | { type: 'runEnded'; result: RunResult }

const LS_DEVICE = 'pnp.deviceId'
const LS_BEST = 'pnp.bestScore'

export function bootState(): AppState {
  let deviceId = localStorage.getItem(LS_DEVICE)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(LS_DEVICE, deviceId)
  }
  return {
    screen: 'reveal',
    deviceId,
    nickname: driverHandle(deviceId),
    car: carFromDeviceId(deviceId),
    seenReveal: false,
    lastRun: null,
    bestScore: Number(localStorage.getItem(LS_BEST) ?? 0),
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'go':
      return {
        ...state,
        screen: action.screen,
        seenReveal: state.seenReveal || state.screen === 'reveal',
      }
    case 'runEnded': {
      const best = Math.max(state.bestScore, action.result.score)
      localStorage.setItem(LS_BEST, String(best))
      return { ...state, screen: 'results', lastRun: action.result, bestScore: best }
    }
  }
}

export function useAppState() {
  return useReducer(reducer, undefined, bootState)
}
