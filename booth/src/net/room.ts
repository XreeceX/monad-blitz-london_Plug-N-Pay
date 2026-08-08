// Room lobby client — host creates, players join, host starts, everyone polls.

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

export type RoomStatus = 'lobby' | 'live' | 'ended'

export interface RoomPlayer {
  deviceId: string
  nick: string
  carName: string
  hue: number
  bestScore: number
}

export interface RoomState {
  roomId: string
  status: RoomStatus
  count: number
  players: RoomPlayer[]
  startedAt: number | null
  serverNow: number
}

export interface CreatedRoom {
  roomId: string
  hostToken: string
  serverNow: number
}

async function json<T>(path: string, init?: RequestInit, timeoutMs = 2500): Promise<T | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`${BASE}${path}`, { ...init, signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function createRoom(): Promise<CreatedRoom | null> {
  return json<CreatedRoom>('/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
}

export async function getRoom(roomId: string): Promise<RoomState | null> {
  return json<RoomState>(`/room/${encodeURIComponent(roomId)}`)
}

export async function joinRoom(
  roomId: string,
  body: { deviceId: string; nickname: string; carId: string; carName: string; hue: number },
): Promise<RoomState | null> {
  return json<RoomState>(`/room/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function startRoom(roomId: string, hostToken: string): Promise<RoomState | null> {
  return json<RoomState>(`/room/${encodeURIComponent(roomId)}/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-host-token': hostToken },
    body: '{}',
  })
}

export async function resetRoom(roomId: string, hostToken: string): Promise<RoomState | null> {
  return json<RoomState>(`/room/${encodeURIComponent(roomId)}/reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-host-token': hostToken },
    body: '{}',
  })
}

/** Public join URL encoded into the host QR. */
export function joinUrl(roomId: string): string {
  const base =
    (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, '') ??
    `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`
  return `${base}/?room=${encodeURIComponent(roomId)}`
}

export function roomFromLocation(): string | null {
  const q = new URLSearchParams(window.location.search).get('room')
  if (q) return q.toUpperCase()
  const hash = window.location.hash.replace(/^#/, '')
  if (hash.startsWith('r=')) return hash.slice(2).toUpperCase()
  return null
}
