// The public leaderboard screen — booth spec §3.8, FR-BOOTH-10/11/12.
// Same room-scoped /api/leaderboard as player phones, so ranks stay consistent.
// Top 3 celebrate; top 10 highlighted. No join QR — lobby is locked once live.

import { useEffect, useRef, useState } from 'react'
import { getLeaderboard, getWall, type LeaderboardEntry, type WallData } from '../net/relay'
import { fmtWh } from '../components/Counter'

const SEAL_KEY = 'pnp.wall.sealed'
const MEDAL = ['🥇', '🥈', '🥉'] as const

function wallRowClass(r: LeaderboardEntry) {
  const bits = ['wall-row', 'wall-top10']
  if (r.rank === 1) bits.push('wall-gold')
  else if (r.rank === 2) bits.push('wall-silver')
  else if (r.rank === 3) bits.push('wall-bronze')
  return bits.join(' ')
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
        <p className="seal-sub">Your own score stays on your own phone.</p>
      </div>
    )
  }

  const champion = entries.find((e) => e.rank === 1) ?? null

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

      {champion && (
        <div className="wall-champ">
          <span className="wall-champ-medal" aria-hidden>
            🥇
          </span>
          <div className="wall-champ-copy">
            <p className="label">Leader</p>
            <p className="num wall-champ-nick">{champion.nick}</p>
          </div>
          <p className="num wall-champ-score">{champion.score.toLocaleString('en-GB')}</p>
        </div>
      )}

      <div className="wall-body wall-body-no-qr">
        <ol className="wall-list">
          {entries.length === 0 && (
            <li className="wall-row wall-empty">
              <span className="lb-nick">Waiting for the first run…</span>
            </li>
          )}
          {entries.slice(0, 10).map((r) => (
            <li key={`${r.rank}-${r.deviceId ?? r.nick}`} className={wallRowClass(r)}>
              <span className="num wall-rank" aria-label={`Rank ${r.rank}`}>
                {r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}
              </span>
              <span className="num wall-nick">{r.nick}</span>
              {r.carName && <span className="wall-car label">{r.carName}</span>}
              <span className="num wall-score">{r.score.toLocaleString('en-GB')}</span>
            </li>
          ))}
        </ol>

        <aside className="wall-side">
          <div className="wall-stat">
            <span className="num wall-stat-value">{wall?.count ?? 0}</span>
            <span className="label">CARS IN ROOM</span>
          </div>
          <div className="wall-stat">
            <span className="num wall-stat-value">{Math.round(wall?.totalKW ?? 0)}</span>
            <span className="label">ROOM kW</span>
          </div>
          <div className="wall-stat">
            <span className="num wall-stat-value">{fmtWh(wall?.totalWh ?? 0)}</span>
            <span className="label">TOTAL Wh MOVED</span>
          </div>
          <div className="wall-stat wall-stat-v2g">
            <span className="num wall-stat-value">
              {(wall?.totalV2gMon ?? 0).toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="label">TOTAL V2G CASH · MON</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
