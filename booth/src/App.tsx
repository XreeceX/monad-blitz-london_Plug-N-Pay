// Screen state machine — booth spec §3, plus host lobby for synchronized rounds.

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
import { createRoom, getRoom, roomFromLocation } from './net/room'

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
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [hostError, setHostError] = useState<string | null>(null)

  // Deep-link: ?room=ABCD → waiting (or host if we still have the token).
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
    setHostError(null)
    const created = await createRoom()
    if (!created) {
      setHostError('Could not create a room — start the booth server first.')
      return
    }
    setRoomId(created.roomId)
    setHostToken(created.hostToken)
    sessionStorage.setItem(`pnp.host.${created.roomId}`, created.hostToken)
    // Put the room in the URL so refreshing the host screen keeps the lobby.
    const url = new URL(window.location.href)
    url.searchParams.set('room', created.roomId)
    url.hash = 'host'
    window.history.replaceState(null, '', url.toString())
    setMode('host')
  }, [])

  const onJoin = useCallback(async () => {
    setJoining(true)
    setJoinError(null)
    const id = joinCode.trim().toUpperCase()
    const room = await getRoom(id)
    setJoining(false)
    if (!room) {
      setJoinError('Room not found. Check the code on the host screen.')
      return
    }
    setRoomId(id)
    const url = new URL(window.location.href)
    url.searchParams.set('room', id)
    url.hash = ''
    window.history.replaceState(null, '', url.toString())
    setMode('waiting')
  }, [joinCode])

  const leaveRoom = useCallback(() => {
    setRoomId(null)
    setHostToken(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    url.hash = ''
    window.history.replaceState(null, '', url.toString())
    setMode('landing')
  }, [])

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
        <Landing
          onHost={() => void onHost()}
          onSolo={enterPlay}
          joinCode={joinCode}
          onJoinCode={setJoinCode}
          onJoin={() => void onJoin()}
          joining={joining}
          error={joinError ?? hostError}
        />
      </>
    )
  }

  if (mode === 'host' && roomId && hostToken) {
    return (
      <>
        <div className="sim-label">SIMULATION — SAME ENGINE, NOTHING ON-CHAIN</div>
        <HostLobby
          roomId={roomId}
          hostToken={hostToken}
          onLive={() => {
            // Keep the host on this screen — player phones leave Waiting together.
            // Optional: open the public wall in another tab at /#wall?room=…
          }}
          onBack={leaveRoom}
        />
      </>
    )
  }

  // Host who lost their token (refresh) but still has ?room=& #host — show read-only wait.
  if (mode === 'host' && roomId && !hostToken) {
    return (
      <>
        <div className="sim-label">SIMULATION — SAME ENGINE, NOTHING ON-CHAIN</div>
        <div className="screen landing">
          <p className="landing-error">
            Host session expired after refresh. Create a new room from the frontpage.
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
