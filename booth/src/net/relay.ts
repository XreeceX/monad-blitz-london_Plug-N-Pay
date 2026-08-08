// Game-server client — booth spec §8.
// Principle: the phone is authoritative for its own gameplay and never blocks
// on the network. Every request is fire-and-forget. Every failure is silent.
// No spinner, no retry dialog, no error toast anywhere in this app
// (FR-BOOTH-2, FR-BOOTH-4). Zero chain calls, zero key material (FR-SPLIT-1).

import { TICK_REPORT_MS, SURGE_WINDOWS_MS, PRICE_MON_PER_KWH, V2G_MON_PER_KWH } from '../game/constants'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

export interface SessionConfig {
  sessionId: string
  startAt: number
  serverNow: number
  surgeWindows: Array<[number, number]>
  priceMonPerKwh: number
  v2gMonPerKwh: number
}

export interface LeaderboardEntry {
  rank: number
  nick: string
  score: number
  carName?: string
}

export interface EndResult {
  rank: number
  top: LeaderboardEntry[]
}

/** serverNow - Date.now(), measured at session start. 0 when offline. */
export let clockOffset = 0

/** True once any request has succeeded; drives nothing player-visible. */
export let serverReachable = false

async function post<T>(path: string, body: unknown, timeoutMs = 2500): Promise<T | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      keepalive: true,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    serverReachable = true
    if (res.status === 204) return {} as T
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function startSession(
  deviceId: string,
  nickname: string,
  carId: string,
): Promise<SessionConfig> {
  const remote = await post<SessionConfig>('/session', { deviceId, nickname, carId }, 1500)
  if (remote && remote.sessionId) {
    clockOffset = remote.serverNow - Date.now()
    return remote
  }
  // Fully local fallback (degradation L2, §9). The player sees nothing wrong.
  return {
    sessionId: `local-${crypto.randomUUID()}`,
    startAt: Date.now(),
    serverNow: Date.now(),
    surgeWindows: SURGE_WINDOWS_MS,
    priceMonPerKwh: PRICE_MON_PER_KWH,
    v2gMonPerKwh: V2G_MON_PER_KWH,
  }
}

// ---- tick queue (§8): in-memory, cap 50, backoff 250ms/1s/4s, drop oldest ----

interface Tick { t: number; kW: number; whDelta: number; taps: number }

const queue: Array<{ seq: number; tick: Tick }> = []
let seq = 0
let sessionId: string | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
let backoffIdx = 0
const BACKOFFS = [TICK_REPORT_MS, 250, 1000, 4000]

export function bindTickSession(id: string) {
  sessionId = id
  seq = 0
  queue.length = 0
}

export function enqueueTick(tick: Tick) {
  if (!sessionId || sessionId.startsWith('local-')) return
  queue.push({ seq: ++seq, tick })
  if (queue.length > 50) queue.shift()
  scheduleFlush(0)
}

function scheduleFlush(delay: number) {
  if (flushTimer !== null) return
  flushTimer = setTimeout(flush, delay)
}

async function flush() {
  flushTimer = null
  if (!sessionId || queue.length === 0) return
  const batch = queue.splice(0, queue.length)
  const ok = await post<unknown>('/tick', {
    sessionId,
    seq: batch[batch.length - 1].seq,
    ticks: batch.map((b) => b.tick),
  })
  if (ok === null) {
    // put them back, retry with backoff, never surface to the player
    queue.unshift(...batch)
    if (queue.length > 50) queue.length = 50
    backoffIdx = Math.min(backoffIdx + 1, BACKOFFS.length - 1)
    scheduleFlush(BACKOFFS[backoffIdx])
  } else {
    backoffIdx = 0
  }
}

/** Best-effort delivery when the page is hiding (§8). */
export function flushOnHide() {
  if (!sessionId || sessionId.startsWith('local-') || queue.length === 0) return
  const batch = queue.splice(0, queue.length)
  const payload = JSON.stringify({
    sessionId,
    seq: batch[batch.length - 1].seq,
    ticks: batch.map((b) => b.tick),
  })
  navigator.sendBeacon?.(`${BASE}/tick`, new Blob([payload], { type: 'application/json' }))
}

export async function endSession(payload: {
  sessionId: string
  whCharged: number
  whDischarged: number
  score: number
  tapCount: number
}): Promise<EndResult | null> {
  if (payload.sessionId.startsWith('local-')) return null
  return post<EndResult>('/session/end', payload)
}

export async function getLeaderboard(n = 10): Promise<{ entries: LeaderboardEntry[]; updatedAt: number } | null> {
  try {
    const res = await fetch(`${BASE}/leaderboard?n=${n}`)
    if (!res.ok) return null
    serverReachable = true
    return await res.json()
  } catch {
    return null
  }
}

export interface WallData {
  players: Array<{ id: string; nick: string; hue: number; kW: number; soc: number; phase: string }>
  totalKW: number
  totalWh: number
  totalMon: number
  count: number
  surgeAt?: number | null
}

export async function getWall(): Promise<WallData | null> {
  try {
    const res = await fetch(`${BASE}/wall`)
    if (!res.ok) return null
    serverReachable = true
    return await res.json()
  } catch {
    return null
  }
}
