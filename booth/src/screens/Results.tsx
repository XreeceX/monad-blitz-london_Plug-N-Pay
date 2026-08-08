// Results — one-shot presentation round. No replay; leaderboard is the next step.

import { Counter, fmtWh, fmtMon } from '../components/Counter'
import { claimCode } from '../game/cars'
import type { CarSpec } from '../game/cars'
import type { RunResult } from '../state/session'

interface Props {
  car: CarSpec
  deviceId: string
  result: RunResult
  bestScore: number
  onLeaderboard: () => void
}

const CLAIM_URL = import.meta.env.VITE_CLAIM_FORM_URL as string | undefined

export function Results({ car, deviceId, result, bestScore, onLeaderboard }: Props) {
  return (
    <div className="screen results">
      <p className="label results-title">SESSION COMPLETE</p>

      <div className="score-block">
        <span className="num score-value">{result.score.toLocaleString('en-GB')}</span>
        <span className="label">SCORE{result.score >= bestScore ? ' · PERSONAL BEST' : ''}</span>
        {result.rank !== null && (
          <span className="rank-line num">RANK #{result.rank}</span>
        )}
      </div>

      <div className="results-grid">
        <Counter value={fmtWh(result.whCharged)} unit="Wh" label="CHARGED" />
        <Counter value={fmtMon(result.monPaid)} unit="MON" label="PAID" />
      </div>

      {result.flipped ? (
        <div className="bonus-row">
          <span className="label">V2G BONUS</span>
          <span className="num">
            +{fmtMon(result.monEarned)} MON · {fmtWh(result.whDischarged)} Wh sold back
          </span>
        </div>
      ) : (
        <p className="flip-note muted">Bonus missed — the battery didn’t hit 100% before time ran out.</p>
      )}

      <div className="plate-chip num results-plate">
        {car.name} · {car.plateKwh} kWh
      </div>

      <div className="results-actions">
        <button className="primary" onClick={onLeaderboard}>
          Leaderboard
        </button>
      </div>

      <p className="claim-line">
        Claim code <span className="num">{claimCode(deviceId)}</span> — keep this to prove a
        winning run.
        {CLAIM_URL && (
          <>
            {' '}
            <a href={CLAIM_URL} target="_blank" rel="noreferrer">
              Claim form
            </a>
          </>
        )}
      </p>
    </div>
  )
}
