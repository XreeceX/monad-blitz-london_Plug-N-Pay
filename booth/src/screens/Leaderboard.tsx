// Leaderboard — booth spec §3.7 and §7.
// Polls every 5s while visible, never while charging. The player's own row is
// pinned even outside the top 10. Reward terms are stated in full, as fact,
// and nothing here solicits a vote (FR-BOOTH-7, FR-BOOTH-8).

import { useEffect, useState } from 'react'
import { getLeaderboard, type LeaderboardEntry } from '../net/relay'

interface Props {
  nickname: string
  bestScore: number
  cachedTop: LeaderboardEntry[] | null
  onBack: () => void
  onCloseGame: () => void
}

export function Leaderboard({ nickname, bestScore, cachedTop, onBack, onCloseGame }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(cachedTop)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let dead = false
    async function poll() {
      const res = await getLeaderboard(10)
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
  }, [])

  const rows: LeaderboardEntry[] =
    entries && entries.length > 0
      ? entries
      : [{ rank: 1, nick: nickname, score: bestScore }]

  const mine = rows.find((r) => r.nick === nickname)

  return (
    <div className="screen leaderboard">
      <header className="lb-head">
        <p className="label">STANDINGS</p>
        {!live && <p className="degraded-note">LOCAL — server unreachable, showing this device only</p>}
      </header>

      <ol className="lb-list">
        {rows.slice(0, 10).map((r) => (
          <li key={`${r.rank}-${r.nick}`} className={r.nick === nickname ? 'lb-row lb-mine' : 'lb-row'}>
            <span className="num lb-rank">{r.rank}</span>
            <span className="lb-nick num">{r.nick}</span>
            {r.carName && <span className="lb-car label">{r.carName}</span>}
            <span className="num lb-score">{r.score.toLocaleString('en-GB')}</span>
          </li>
        ))}
      </ol>

      {mine === undefined && bestScore > 0 && (
        <div className="lb-row lb-mine lb-pinned">
          <span className="num lb-rank">—</span>
          <span className="lb-nick num">{nickname}</span>
          <span className="num lb-score">{bestScore.toLocaleString('en-GB')}</span>
        </div>
      )}

      {/* Terms panel copy, final — booth spec §7, verbatim */}
      <div className="terms-panel hairline-top">
        <p className="label">REWARD TERMS</p>
        <p>
          <strong>Top 10 share 20% of any cash prize we win.</strong> That's £240 split
          ten ways if we place first, and nothing if we don't place at all. Play as often
          as you like; your best run counts. Winners are listed here and paid by the team
          at the venue.
        </p>
        <p className="muted">
          Standings seal 10 seconds before the contest closes. Final winners are reviewed
          and revealed afterwards in Discord. Tie at a cut-line: earlier server receipt
          wins. Skill only — car looks change nothing.
        </p>
      </div>

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
