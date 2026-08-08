// Minimal game server for the booth demo.
// Owns room lobby sync (create / join / start) and a best-score leaderboard.
// Friend can replace or extend this — the frontend speaks the same /api shapes.
// Serves the Vite build in production so one Render Web Service is enough.

import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const ROOM_TTL_MS = 2 * 60 * 60 * 1000 // 2h
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** @typedef {{ deviceId: string, nick: string, carId: string, carName: string, hue: number, joinedAt: number, lastSeen: number, bestScore: number }} Player */
/** @typedef {{ id: string, hostToken: string, status: 'lobby'|'live'|'ended'|'closed', createdAt: number, startedAt: number|null, players: Map<string, Player>, scores: Map<string, { nick: string, score: number, carName: string, at: number }>, totalWh: number, totalMon: number }} Room */
/** @typedef {{ sessionId: string, deviceId: string, nick: string, carId: string, roomId: string|null, lastSeq: number, lastKW: number, totalWh: number, totalMon: number, priceMonPerKwh: number, v2gMonPerKwh: number, lastSeen: number, ended: boolean }} LiveSession */

/** @type {Map<string, Room>} */
const rooms = new Map()
/** @type {Map<string, LiveSession>} */
const sessions = new Map()

/** A session counts as "live" on the wall while ticks arrived within this window. */
const LIVE_MS = 5_000

function code(n = 4) {
  const bytes = randomBytes(n)
  let out = ''
  for (let i = 0; i < n; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return out
}

function freshRoomId() {
  for (let i = 0; i < 20; i++) {
    const id = code(4)
    if (!rooms.has(id)) return id
  }
  return code(6)
}

function prune() {
  const now = Date.now()
  for (const [id, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) rooms.delete(id)
  }
}
setInterval(prune, 60_000)

function publicRoom(room) {
  const players = [...room.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      deviceId: p.deviceId,
      nick: p.nick,
      carName: p.carName,
      hue: p.hue,
      bestScore: p.bestScore,
    }))
  return {
    roomId: room.id,
    status: room.status,
    count: players.length,
    players,
    startedAt: room.startedAt,
    serverNow: Date.now(),
  }
}

const app = express()
app.use(express.json({ limit: '32kb' }))

// CORS for local Vite → server split during `npm run dev`
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-host-token')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size })
})

// Public base URL for QR codes. On Render, RENDER_EXTERNAL_URL is set
// automatically so phones join the deployed site, not localhost.
app.get('/api/config', (_req, res) => {
  const publicUrl = (
    process.env.PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.VITE_PUBLIC_URL ||
    ''
  ).replace(/\/$/, '')
  res.json({
    publicUrl: publicUrl || null,
    serverNow: Date.now(),
  })
})

app.post('/api/room', (_req, res) => {
  const id = freshRoomId()
  const hostToken = randomBytes(16).toString('hex')
  /** @type {Room} */
  const room = {
    id,
    hostToken,
    status: 'lobby',
    createdAt: Date.now(),
    startedAt: null,
    players: new Map(),
    scores: new Map(),
    totalWh: 0,
    totalMon: 0,
  }
  rooms.set(id, room)
  res.json({ roomId: id, hostToken, serverNow: Date.now() })
})

app.get('/api/room/:id', (req, res) => {
  const room = rooms.get(String(req.params.id).toUpperCase())
  if (!room) return res.status(404).json({ error: 'room_not_found' })
  res.json(publicRoom(room))
})

app.post('/api/room/:id/join', (req, res) => {
  const room = rooms.get(String(req.params.id).toUpperCase())
  if (!room) return res.status(404).json({ error: 'room_not_found' })
  if (room.status !== 'lobby') {
    return res.status(403).json({ error: 'room_closed', status: room.status })
  }
  const { deviceId, nickname, carId, carName, hue } = req.body ?? {}
  if (!deviceId || !nickname) return res.status(400).json({ error: 'bad_request' })

  const existing = room.players.get(deviceId)
  const player = {
    deviceId,
    nick: String(nickname).slice(0, 24),
    carId: String(carId ?? ''),
    carName: String(carName ?? ''),
    hue: Number(hue) || 180,
    joinedAt: existing?.joinedAt ?? Date.now(),
    lastSeen: Date.now(),
    bestScore: existing?.bestScore ?? 0,
  }
  room.players.set(deviceId, player)
  res.json(publicRoom(room))
})

app.post('/api/room/:id/start', (req, res) => {
  const room = rooms.get(String(req.params.id).toUpperCase())
  if (!room) return res.status(404).json({ error: 'room_not_found' })
  const token = req.get('x-host-token')
  if (!token || token !== room.hostToken) return res.status(403).json({ error: 'forbidden' })
  if (room.status === 'closed' || room.status === 'ended') {
    return res.status(403).json({ error: 'room_closed', status: room.status })
  }
  if (room.status === 'lobby') {
    room.status = 'live'
    room.startedAt = Date.now()
  }
  res.json(publicRoom(room))
})

app.post('/api/room/:id/close', (req, res) => {
  const room = rooms.get(String(req.params.id).toUpperCase())
  if (!room) return res.status(404).json({ error: 'room_not_found' })
  const token = req.get('x-host-token')
  if (!token || token !== room.hostToken) return res.status(403).json({ error: 'forbidden' })
  room.status = room.status === 'live' ? 'ended' : 'closed'
  res.json(publicRoom(room))
})

app.post('/api/room/:id/reset', (req, res) => {
  const room = rooms.get(String(req.params.id).toUpperCase())
  if (!room) return res.status(404).json({ error: 'room_not_found' })
  const token = req.get('x-host-token')
  if (!token || token !== room.hostToken) return res.status(403).json({ error: 'forbidden' })
  room.status = 'lobby'
  room.startedAt = null
  res.json(publicRoom(room))
})

app.post('/api/session', (req, res) => {
  const body = req.body ?? {}
  const deviceId = String(body.deviceId ?? '')
  const nick = String(body.nickname ?? 'DRIVER').slice(0, 24)
  const carId = String(body.carId ?? '')
  const roomId = body.roomId ? String(body.roomId).toUpperCase() : null
  const priceMonPerKwh = Number(body.priceMonPerKwh) || 0.12
  const v2gMonPerKwh = Number(body.v2gMonPerKwh) || 0.3
  const sessionId = `s-${deviceId.slice(0, 8) || 'anon'}-${Date.now().toString(36)}`

  /** @type {LiveSession} */
  const sess = {
    sessionId,
    deviceId,
    nick,
    carId,
    roomId: roomId && rooms.has(roomId) ? roomId : roomId,
    lastSeq: 0,
    lastKW: 0,
    totalWh: 0,
    totalMon: 0,
    priceMonPerKwh,
    v2gMonPerKwh,
    lastSeen: Date.now(),
    ended: false,
  }
  sessions.set(sessionId, sess)

  res.json({
    sessionId,
    startAt: Date.now(),
    serverNow: Date.now(),
    surgeWindows: [
      [4000, 6000],
      [10500, 12500],
    ],
    priceMonPerKwh,
    v2gMonPerKwh,
    label: 'SIMULATION — same engine, nothing on-chain',
  })
})

app.post('/api/tick', (req, res) => {
  const body = req.body ?? {}
  const sessionId = String(body.sessionId ?? '')
  const sess = sessions.get(sessionId)
  if (!sess || sess.ended) return res.sendStatus(204)

  const seq = Number(body.seq) || 0
  // Idempotent on seq: ignore stale/replayed batches (FR-SPLIT / booth §8).
  if (seq > 0 && seq <= sess.lastSeq) return res.sendStatus(204)
  if (seq > 0) sess.lastSeq = seq

  const ticks = Array.isArray(body.ticks) ? body.ticks : []
  let batchWh = 0
  let batchMon = 0
  let lastKW = sess.lastKW
  for (const t of ticks) {
    const kW = Number(t?.kW) || 0
    const whDelta = Math.abs(Number(t?.whDelta) || 0)
    lastKW = kW
    batchWh += whDelta
    // Display aggregate only — charge rate; V2G premium is reflected in score, not this meter.
    batchMon += (whDelta / 1000) * sess.priceMonPerKwh
  }
  sess.lastKW = lastKW
  sess.totalWh += batchWh
  sess.totalMon += batchMon
  sess.lastSeen = Date.now()

  // Bind to a room if the phone omitted roomId — match the joined player seat.
  if (!sess.roomId || !rooms.has(sess.roomId)) {
    for (const room of rooms.values()) {
      if (room.players.has(sess.deviceId)) {
        sess.roomId = room.id
        break
      }
    }
  }
  if (sess.roomId && rooms.has(sess.roomId)) {
    const room = rooms.get(sess.roomId)
    room.totalWh += batchWh
    room.totalMon += batchMon
  }

  res.sendStatus(204)
})

app.post('/api/session/end', (req, res) => {
  const { sessionId, score } = req.body ?? {}
  const sess = sessionId ? sessions.get(String(sessionId)) : null
  if (sess) {
    sess.ended = true
    sess.lastKW = 0
    sess.lastSeen = Date.now()
  }

  // Prefer room-scoped scores when a roomId is provided
  const roomId = (req.body?.roomId ? String(req.body.roomId) : sess?.roomId ?? '')
    .toUpperCase() || null
  const nick = String(req.body?.nickname ?? sess?.nick ?? 'DRIVER')
  const carName = String(req.body?.carName ?? '')
  const deviceId = String(req.body?.deviceId ?? sess?.deviceId ?? sessionId ?? 'x')
  const sc = Math.round(Number(score) || 0)

  // If client never opened a room-scoped session, attach ended Wh to the live room once.
  if (sess && !sess.roomId && roomId && rooms.has(roomId)) {
    sess.roomId = roomId
    const room = rooms.get(roomId)
    room.totalWh += sess.totalWh
    room.totalMon += sess.totalMon
  }

  if (roomId && rooms.has(roomId)) {
    const room = rooms.get(roomId)
    const prev = room.scores.get(deviceId)
    if (!prev || sc > prev.score) {
      room.scores.set(deviceId, { nick, score: sc, carName, at: Date.now() })
    }
    const p = room.players.get(deviceId)
    if (p && sc > p.bestScore) p.bestScore = sc
  }

  const entries = roomLeaderboard(roomId)
  const mine = entries.find((e) => e.deviceId === deviceId)
  res.json({ rank: mine?.rank ?? entries.length + 1, top: entries.slice(0, 10) })
})

function roomLeaderboard(roomId) {
  if (!roomId || !rooms.has(roomId)) {
    // Aggregate across all live rooms for the public wall
    /** @type {Map<string, { deviceId: string, nick: string, score: number, carName: string, at: number }>} */
    const all = new Map()
    for (const room of rooms.values()) {
      for (const [id, s] of room.scores) {
        const prev = all.get(id)
        if (!prev || s.score > prev.score) all.set(id, { deviceId: id, ...s })
      }
    }
    return [...all.values()]
      .sort((a, b) => b.score - a.score || a.at - b.at)
      .map((e, i) => ({ rank: i + 1, nick: e.nick, score: e.score, carName: e.carName, deviceId: e.deviceId }))
  }
  const room = rooms.get(roomId)
  return [...room.scores.entries()]
    .map(([deviceId, s]) => ({ deviceId, nick: s.nick, score: s.score, carName: s.carName, at: s.at }))
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .map((e, i) => ({ rank: i + 1, nick: e.nick, score: e.score, carName: e.carName, deviceId: e.deviceId }))
}

app.get('/api/leaderboard', (req, res) => {
  const n = Math.min(Number(req.query.n) || 10, 50)
  const roomId = req.query.room ? String(req.query.room).toUpperCase() : null
  const entries = roomLeaderboard(roomId).slice(0, n)
  res.json({ entries, updatedAt: Date.now() })
})

app.get('/api/wall', (req, res) => {
  const roomId = req.query.room ? String(req.query.room).toUpperCase() : null
  const room = roomId
    ? rooms.get(roomId)
    : [...rooms.values()].find((r) => r.status === 'live') ?? [...rooms.values()][0]
  if (!room) {
    return res.json({
      players: [],
      totalKW: 0,
      totalWh: 0,
      totalMon: 0,
      count: 0,
      surgeAt: null,
      status: 'idle',
      label: 'SIMULATION — same engine, nothing on-chain',
    })
  }

  const now = Date.now()
  /** @type {Map<string, LiveSession>} */
  const byDevice = new Map()
  for (const sess of sessions.values()) {
    if (sess.roomId && sess.roomId !== room.id) continue
    if (!sess.roomId && !room.players.has(sess.deviceId)) continue
    const prev = byDevice.get(sess.deviceId)
    if (!prev || sess.lastSeen > prev.lastSeen) byDevice.set(sess.deviceId, sess)
  }

  let totalKW = 0
  const players = [...room.players.values()].map((p) => {
    const sess = byDevice.get(p.deviceId)
    const live = Boolean(sess && !sess.ended && now - sess.lastSeen <= LIVE_MS)
    const kW = live ? sess.lastKW : 0
    totalKW += kW
    return {
      id: p.deviceId,
      nick: p.nick,
      hue: p.hue,
      kW,
      soc: 0,
      phase: live ? 'charge' : room.status === 'live' ? 'idle' : 'idle',
    }
  })

  // Also count live sessions that joined via ticks but somehow missed the player map
  for (const sess of byDevice.values()) {
    if (room.players.has(sess.deviceId)) continue
    const live = !sess.ended && now - sess.lastSeen <= LIVE_MS
    if (live) totalKW += sess.lastKW
  }

  res.json({
    players,
    totalKW,
    totalWh: room.totalWh,
    totalMon: room.totalMon,
    count: players.length,
    surgeAt: null,
    status: room.status,
    roomId: room.id,
    label: 'SIMULATION — same engine, nothing on-chain',
  })
})

// Production: serve the built SPA (Express 5 needs named wildcards, not '*')
const dist = join(__dirname, 'dist')
app.use(express.static(dist))
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(join(dist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`plug-n-pay booth server on :${PORT}`)
})
