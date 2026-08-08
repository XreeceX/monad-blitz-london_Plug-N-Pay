// Screen state machine — booth spec §3, plus host lobby for a single synced round.
// Frontpage is host-only. Players arrive only via the QR (?room=CODE).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppState, type RunResult } from './state/session'
import { Landing } from './screens/Landing'
import { HostLobby } from './screens/HostLobby'
import { Waiting } from './screens/Waiting'
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
import { createRoom, roomFromLocation } from './net/room'

type Mode = 'landing' | 'host' | 'waiting' | 'play'

export default function App() {
  const [state, dispatch] = useAppState()
  const [session, setSession] = useState<SessionConfig | null>(null)
  const sessionRef = useRef<Promise<SessionConfig> | null>(null)

  const initialRoom = roomFromLocation()
  const initialHost =
    initialRoom && sessionStorage.getItem(`pnp.host.${initialRoom}`)
      ? sessionStorage.getItem(`pnp.host.${initialRoom}`)
      : null
  const isHostHash = window.location.hash === '#host'

  const [mode, setMode] = useState<Mode>(() => {
    if (initialRoom && (initialHost || isHostHash)) return 'host'
    if (initialRoom) return 'waiting'
    return 'landing'
  })
  const [roomId, setRoomId] = useState<string | null>(() => initialRoom)
  const [hostToken, setHostToken] = useState<string | null>(() => initialHost)
  const [hosting, setHosting] = useState(false)
  const [hostError, setHostError] = useState<string | null>(null)

  useEffect(() => {
    const id = roomFromLocation()
    if (!id) return
    setRoomId(id)
    const token = sessionStorage.getItem(`pnp.host.${id}`)
    if (token || window.location.hash === '#host') {
      if (token) setHostToken(token)
      setMode('host')
    } else {
      setMode('waiting')
    }
  }, [])

  const enterPlay = useCallback(() => {
    setMode('play')
    dispatch({ type: 'go', screen: 'reveal' })
  }, [dispatch])

  const onHost = useCallback(async () => {
    setHosting(true)
    setHostError(null)
    const created = await createRoom()
    setHosting(false)
    if (!created) {
      setHostError('Could not open the lobby — is the booth server running?')
      return
    }
    setRoomId(created.roomId)
    setHostToken(created.hostToken)
    sessionStorage.setItem(`pnp.host.${created.roomId}`, created.hostToken)
    const url = new URL(window.location.href)
    url.searchParams.set('room', created.roomId)
    url.hash = 'host'
    window.history.replaceState(null, '', url.toString())
    setMode('host')
  }, [])

  const leaveRoom = useCallback(() => {
    if (roomId) sessionStorage.removeItem(`pnp.host.${roomId}`)
    setRoomId(null)
    setHostToken(null)
    setSession(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    url.hash = ''
    window.history.replaceState(null, '', url.toString())
    setMode('landing')
  }, [roomId])

  const closeGame = useCallback(() => {
    leaveRoom()
  }, [leaveRoom])

  const onPlugged = useCallback(() => {
    sessionRef.current = startSession(state.deviceId, state.nickname, state.car.id, roomId)
    void sessionRef.current.then((cfg) => {
      bindTickSession(cfg.sessionId)
      setSession(cfg)
    })
    dispatch({ type: 'go', screen: 'handshake' })
  }, [state.deviceId, state.nickname, state.car.id, roomId, dispatch])

  const onHandshakeDone = useCallback(() => {
    dispatch({ type: 'go', screen: 'charging' })
  }, [dispatch])

  const onRunEnd = useCallback(
    (partial: Omit<RunResult, 'rank' | 'top'>) => {
      const result: RunResult = { ...partial, rank: null, top: null }
      dispatch({ type: 'runEnded', result })
      const sid = session?.sessionId
      if (sid) {
        void endSession({
          sessionId: sid,
          whCharged: partial.whCharged,
          whDischarged: partial.whDischarged,
          score: partial.score,
          tapCount: partial.tapCount,
          roomId: roomId ?? undefined,
          deviceId: state.deviceId,
          nickname: state.nickname,
          carName: state.car.name,
        }).then((res) => {
          if (res) dispatch({ type: 'runEnded', result: { ...result, rank: res.rank, top: res.top } })
        })
      }
    },
    [dispatch, session, roomId, state.deviceId, state.nickname, state.car.name],
  )

  if (mode === 'landing') {
    return (
      <>
        <div className="sim-label">SIMULATION — SAME ENGINE, NOTHING ON-CHAIN</div>
        <Landing onHost={() => void onHost()} hosting={hosting} error={hostError} />
      </>
    )
  }

  if (mode === 'host' && roomId && hostToken) {
    return (
      <>
        <div className="sim-label">SIMULATION — SAME ENGINE, NOTHING ON-CHAIN</div>
        <HostLobby roomId={roomId} hostToken={hostToken} onBack={leaveRoom} />
      </>
    )
  }

  if (mode === 'host' && roomId && !hostToken) {
    return (
      <>
        <div className="sim-label">SIMULATION — SAME ENGINE, NOTHING ON-CHAIN</div>
        <div className="screen landing">
          <p className="landing-error">
            Host session expired after refresh. Open a new lobby from the frontpage.
          </p>
          <button className="primary" onClick={leaveRoom}>
            BACK
          </button>
        </div>
      </>
    )
  }

  if (mode === 'waiting' && roomId) {
    return (
      <>
        <div className="sim-label">SIMULATION — SAME ENGINE, NOTHING ON-CHAIN</div>
        <Waiting
          roomId={roomId}
          deviceId={state.deviceId}
          nickname={state.nickname}
          car={state.car}
          onStart={enterPlay}
          onLeave={leaveRoom}
        />
      </>
    )
  }

  return (
    <>
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
          onLeaderboard={() => dispatch({ type: 'go', screen: 'leaderboard' })}
        />
      )}
      {state.screen === 'leaderboard' && (
        <Leaderboard
          nickname={state.nickname}
          deviceId={state.deviceId}
          bestScore={state.bestScore}
          roomId={roomId}
          myRank={state.lastRun?.rank ?? null}
          cachedTop={state.lastRun?.top ?? null}
          onBack={() =>
            dispatch({ type: 'go', screen: state.lastRun ? 'results' : 'garage' })
          }
          onCloseGame={closeGame}
        />
      )}
    </>
  )
}
