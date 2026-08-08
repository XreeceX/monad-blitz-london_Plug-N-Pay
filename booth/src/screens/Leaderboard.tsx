// Leaderboard — booth spec §3.7.
// Polls the same room-scoped /api/leaderboard the host wall uses, so ranks match.
// Top 3 celebrate; the full top 10 is highlighted. No prize/reward copy.

import { useEffect, useState } from 'react'
import { getLeaderboard, type LeaderboardEntry } from '../net/relay'

interface Props {
  nickname: string
  deviceId: string
  bestScore: number
  roomId: string | null
  myRank: number | null
  cachedTop: LeaderboardEntry[] | null
  onBack: () => void
  onCloseGame: () => void
}

const MEDAL = ['🥇', '🥈', '🥉'] as const
const PODIUM = ['1st', '2nd', '3rd'] as const

function isMine(r: LeaderboardEntry, deviceId: string, nickname: string) {
  if (r.deviceId && deviceId) return r.deviceId === deviceId
  return r.nick === nickname
}

function rowClass(r: LeaderboardEntry, deviceId: string, nickname: string) {
  const bits = ['lb-row', 'lb-top10']
  if (r.rank === 1) bits.push('lb-gold')
  else if (r.rank === 2) bits.push('lb-silver')
  else if (r.rank === 3) bits.push('lb-bronze')
  if (isMine(r, deviceId, nickname)) bits.push('lb-mine')
  return bits.join(' ')
}

export function Leaderboard({
  nickname,
  deviceId,
  bestScore,
  roomId,
  myRank,
  cachedTop,
  onBack,
  onCloseGame,
}: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(cachedTop)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let dead = false
    async function poll() {
      // Same room scope as the host wall — ranks stay consistent.
      const res = await getLeaderboard(10, roomId)
      if (dead) return
      if (res) {
        setEntries(res.entries)
        setLive(true)
      }
    }
    void poll()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void poll()
    }, 5000)
    return () => {
      dead = true
      clearInterval(t)
    }
  }, [roomId])

  const rows: LeaderboardEntry[] =
    entries && entries.length > 0
      ? entries
      : bestScore > 0
        ? [{ rank: myRank ?? 1, nick: nickname, score: bestScore, deviceId }]
        : []

  const mine = rows.find((r) => isMine(r, deviceId, nickname))
  const podium = rows.filter((r) => r.rank <= 3)
  const pinnedRank = mine?.rank ?? myRank

  return (
    <div className="screen leaderboard">
      <header className="lb-head">
        <p className="label">STANDINGS</p>
        {live ? (
          <p className="live-note">Live · same board as the host</p>
        ) : (
          <p className="degraded-note">LOCAL — server unreachable, showing this device only</p>
        )}
      </header>

      {podium.length > 0 && (
        <div className="lb-podium" aria-label="Top three">
          {podium.map((r) => (
            <div
              key={`podium-${r.rank}-${r.nick}`}
              className={`lb-podium-card lb-podium-${r.rank}${isMine(r, deviceId, nickname) ? ' lb-mine' : ''}`}
            >
              <span className="lb-podium-medal" aria-hidden>
                {MEDAL[r.rank - 1]}
              </span>
              <span className="lb-podium-place label">{PODIUM[r.rank - 1]}</span>
              <span className="num lb-podium-nick">{r.nick}</span>
              <span className="num lb-podium-score">{r.score.toLocaleString('en-GB')}</span>
            </div>
          ))}
        </div>
      )}

      <ol className="lb-list">
        {rows.length === 0 && (
          <li className="lb-row lb-empty">
            <span className="lb-nick">No scores yet — be the first.</span>
          </li>
        )}
        {rows.map((r) => (
          <li key={`${r.rank}-${r.deviceId ?? r.nick}`} className={rowClass(r, deviceId, nickname)}>
            <span className="num lb-rank" aria-label={`Rank ${r.rank}`}>
              {r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}
            </span>
            <span className="lb-nick num">{r.nick}</span>
            {r.carName && <span className="lb-car label">{r.carName}</span>}
            <span className="num lb-score">{r.score.toLocaleString('en-GB')}</span>
          </li>
        ))}
      </ol>

      {mine === undefined && bestScore > 0 && (
        <div className="lb-row lb-mine lb-pinned">
          <span className="num lb-rank">{pinnedRank ?? '—'}</span>
          <span className="lb-nick num">{nickname}</span>
          <span className="num lb-score">{bestScore.toLocaleString('en-GB')}</span>
        </div>
      )}

      <div className="lb-actions">
        <button className="primary" onClick={onCloseGame}>
          Close Game
        </button>
        <button className="lb-back" onClick={onBack}>
          Back to results
        </button>
      </div>
    </div>
  )
}
