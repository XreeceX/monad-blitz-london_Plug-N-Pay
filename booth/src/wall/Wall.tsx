// The public leaderboard screen — booth spec §3.8, FR-BOOTH-10/11/12.
// Runs on the booth's big screen (open the app with #wall). Legible across a
// busy room, updates every few seconds, and the seal state is unambiguous —
// a stale screen must never pass for a live one (NFR-R-3: degraded operation
// is labelled, never disguised).

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { getLeaderboard, getWall, type LeaderboardEntry, type WallData } from '../net/relay'
import { fmtWh } from '../components/Counter'

const SEAL_KEY = 'pnp.wall.sealed'

// The join URL players scan. Override with VITE_PUBLIC_URL once deployed;
// otherwise it is this page's own origin, so opening the wall via the LAN IP
// gives phones a scannable address automatically.
const JOIN_URL =
  (import.meta.env.VITE_PUBLIC_URL as string | undefined) ??
  `${window.location.origin}${window.location.pathname}`

function JoinQr() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvasRef.current) return
    void QRCode.toCanvas(canvasRef.current, JOIN_URL, {
      width: 232,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
  }, [])
  return (
    <div className="wall-qr">
      <canvas ref={canvasRef} />
      <span className="label">SCAN TO PLAY</span>
      <span className="num wall-qr-url">{JOIN_URL.replace(/^https?:\/\//, '')}</span>
    </div>
  )
}

export function Wall() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [wall, setWall] = useState<WallData | null>(null)
  const [stale, setStale] = useState(true)
  const [sealed, setSealed] = useState(() => sessionStorage.getItem(SEAL_KEY) === '1')
  const [armSeal, setArmSeal] = useState(false)
  const lastOkRef = useRef(0)

  useEffect(() => {
    let dead = false

    const roomQ = new URLSearchParams(window.location.search).get('room')

    async function pollWall() {
      const res = await getWall(roomQ)
      if (dead) return
      if (res) {
        setWall(res)
        lastOkRef.current = Date.now()
      }
    }
    async function pollLb() {
      const res = await getLeaderboard(10, roomQ)
      if (dead) return
      if (res) {
        setEntries(res.entries)
        lastOkRef.current = Date.now()
      }
    }

    void pollWall()
    void pollLb()
    const t1 = setInterval(pollWall, 1000)
    const t2 = setInterval(pollLb, 5000)
    const t3 = setInterval(() => setStale(Date.now() - lastOkRef.current > 6000), 1000)
    return () => {
      dead = true
      clearInterval(t1)
      clearInterval(t2)
      clearInterval(t3)
    }
  }, [])

  // Host control: press S twice within 3s to seal (FR-BOOTH-11).
  useEffect(() => {
    let armTimer: ReturnType<typeof setTimeout> | null = null
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 's') return
      setArmSeal((armed) => {
        if (armed) {
          sessionStorage.setItem(SEAL_KEY, '1')
          setSealed(true)
          return false
        }
        if (armTimer) clearTimeout(armTimer)
        armTimer = setTimeout(() => setArmSeal(false), 3000)
        return true
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (sealed) {
    return (
      <div className="wall wall-sealed">
        <p className="seal-title">FINAL STANDINGS SEALED</p>
        <p className="seal-sub">
          Winners are reviewed by the team and revealed in Discord after the event.
          Your own score stays on your own phone.
        </p>
      </div>
    )
  }

  return (
    <div className="wall">
      <header className="wall-head">
        <div>
          <h1 className="wall-title">PLUG-N-PAY · BOOTH CONTEST</h1>
          <p className="wall-sub num">SIMULATION — SAME ENGINE, NOTHING ON-CHAIN</p>
        </div>
        <div className="wall-status">
          {stale ? (
            <span className="degraded-note">RECONNECTING — STANDINGS MAY BE STALE</span>
          ) : (
            <span className="live-note">UPDATING LIVE</span>
          )}
          {armSeal && <span className="degraded-note">PRESS S AGAIN TO SEAL</span>}
        </div>
      </header>

      <div className="wall-body">
        <ol className="wall-list">
          {entries.length === 0 && (
            <li className="wall-row wall-empty">
              <span className="lb-nick">Waiting for the first run…</span>
            </li>
          )}
          {entries.slice(0, 10).map((r) => (
            <li key={`${r.rank}-${r.nick}`} className="wall-row">
              <span className="num wall-rank">{r.rank}</span>
              <span className="num wall-nick">{r.nick}</span>
              {r.carName && <span className="wall-car label">{r.carName}</span>}
              <span className="num wall-score">{r.score.toLocaleString('en-GB')}</span>
            </li>
          ))}
        </ol>

        <aside className="wall-side">
          <JoinQr />
          <div className="wall-stat">
            <span className="num wall-stat-value">{wall?.count ?? 0}</span>
            <span className="label">CARS LIVE NOW</span>
          </div>
          <div className="wall-stat">
            <span className="num wall-stat-value">{Math.round(wall?.totalKW ?? 0)}</span>
            <span className="label">ROOM kW</span>
          </div>
          <div className="wall-stat">
            <span className="num wall-stat-value">{fmtWh(wall?.totalWh ?? 0)}</span>
            <span className="label">TOTAL Wh MOVED</span>
          </div>
          <div className="wall-terms">
            <p className="label">REWARD</p>
            <p>
              Top 10 share 20% of any cash prize the team wins — nothing if the team
              doesn't place. Best run counts.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
