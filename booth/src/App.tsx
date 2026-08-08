// Screen state machine — booth spec §3. No router, no navigation.

import { useCallback, useRef, useState } from 'react'
import { useAppState, type RunResult } from './state/session'
import { Reveal } from './screens/Reveal'
import { Garage } from './screens/Garage'
import { Handshake } from './screens/Handshake'
import { Charging } from './screens/Charging'
import { Results } from './screens/Results'
import { Leaderboard } from './screens/Leaderboard'
import {
  startSession,
  bindTickSession,
  endSession,
  type SessionConfig,
} from './net/relay'

export default function App() {
  const [state, dispatch] = useAppState()
  const [session, setSession] = useState<SessionConfig | null>(null)
  const sessionRef = useRef<Promise<SessionConfig> | null>(null)

  // Fired at latch, ~2.2s before charging starts, so the round never waits
  // on the network (FR-BOOTH-2). Resolves to a local session if unreachable.
  const onPlugged = useCallback(() => {
    sessionRef.current = startSession(state.deviceId, state.nickname, state.car.id)
    void sessionRef.current.then((cfg) => {
      bindTickSession(cfg.sessionId)
      setSession(cfg)
    })
    dispatch({ type: 'go', screen: 'handshake' })
  }, [state.deviceId, state.nickname, state.car.id, dispatch])

  const onHandshakeDone = useCallback(() => {
    dispatch({ type: 'go', screen: 'charging' })
  }, [dispatch])

  const onRunEnd = useCallback(
    (partial: Omit<RunResult, 'rank' | 'top'>) => {
      const result: RunResult = { ...partial, rank: null, top: null }
      dispatch({ type: 'runEnded', result })
      // Rank arrives late and silently; nothing blocks on it (§8).
      const sid = session?.sessionId
      if (sid) {
        void endSession({
          sessionId: sid,
          whCharged: partial.whCharged,
          whDischarged: partial.whDischarged,
          score: partial.score,
          tapCount: partial.tapCount,
        }).then((res) => {
          if (res) dispatch({ type: 'runEnded', result: { ...result, rank: res.rank, top: res.top } })
        })
      }
    },
    [dispatch, session],
  )

  return (
    <>
      {/* Permanent honesty label — FR-SPLIT-5 */}
      <div className="sim-label">SIMULATION — SAME ENGINE, NOTHING ON-CHAIN</div>

      {state.screen === 'reveal' && (
        <Reveal
          car={state.car}
          nickname={state.nickname}
          onDone={() => dispatch({ type: 'go', screen: 'garage' })}
        />
      )}
      {(state.screen === 'garage' || state.screen === 'plugging') && (
        <Garage car={state.car} nickname={state.nickname} onPlugged={onPlugged} />
      )}
      {state.screen === 'handshake' && <Handshake car={state.car} onDone={onHandshakeDone} />}
      {state.screen === 'charging' && (
        <Charging car={state.car} session={session} onEnd={onRunEnd} />
      )}
      {state.screen === 'results' && state.lastRun && (
        <Results
          car={state.car}
          deviceId={state.deviceId}
          result={state.lastRun}
          bestScore={state.bestScore}
          onAgain={() => dispatch({ type: 'go', screen: 'garage' })}
          onLeaderboard={() => dispatch({ type: 'go', screen: 'leaderboard' })}
        />
      )}
      {state.screen === 'leaderboard' && (
        <Leaderboard
          nickname={state.nickname}
          bestScore={state.bestScore}
          cachedTop={state.lastRun?.top ?? null}
          onBack={() =>
            dispatch({ type: 'go', screen: state.lastRun ? 'results' : 'garage' })
          }
        />
      )}
    </>
  )
}
