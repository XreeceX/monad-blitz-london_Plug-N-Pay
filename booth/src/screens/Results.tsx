// Results — booth spec §3.7. One primary action: CHARGE AGAIN, same car.

import { Counter, fmtWh, fmtMon } from '../components/Counter'
import { claimCode } from '../game/cars'
import type { CarSpec } from '../game/cars'
import type { RunResult } from '../state/session'

interface Props {
  car: CarSpec
  deviceId: string
  result: RunResult
  bestScore: number
  onAgain: () => void
  onLeaderboard: () => void
}

const CLAIM_URL = import.meta.env.VITE_CLAIM_FORM_URL as string | undefined

export function Results({ car, deviceId, result, bestScore, onAgain, onLeaderboard }: Props) {
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

      <div className="results-grid hairline-top">
        <Counter value={fmtWh(result.whCharged)} unit="Wh" label="CHARGED" />
        <Counter value={fmtWh(result.whDischarged)} unit="Wh" label="SOLD BACK" />
        <Counter value={fmtMon(result.monPaid)} unit="MON" label="PAID" />
        <Counter value={fmtMon(result.monEarned)} unit="MON" label="EARNED" />
      </div>

      {result.flipped ? (
        <p className="flip-note">You reached the Flip — the car sold energy back to the grid.</p>
      ) : (
        <p className="flip-note muted">Fill the battery to 100% to flip into sell-back mode.</p>
      )}

      <div className="plate-chip num results-plate">
        {car.name} · {car.plateKwh} kWh
      </div>

      <div className="results-actions">
        <button className="primary" onClick={onAgain}>
          CHARGE AGAIN
        </button>
        <button onClick={onLeaderboard}>LEADERBOARD</button>
      </div>

      <p className="claim-line">
        Claim code <span className="num">{claimCode(deviceId)}</span> — keep this to
        prove a winning run.
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
