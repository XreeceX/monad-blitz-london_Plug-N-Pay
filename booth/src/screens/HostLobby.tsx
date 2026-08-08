// Host screen for the presentation — QR up, watch joiners, start once.
// The QR must encode the public Render URL, not localhost.

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  closeRoom,
  getRoom,
  isLoopbackUrl,
  joinUrl,
  startRoom,
  type RoomState,
} from '../net/room'

interface Props {
  roomId: string
  hostToken: string
  onBack: () => void
}

export function HostLobby({ roomId, hostToken, onBack }: Props) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [starting, setStarting] = useState(false)
  const [closing, setClosing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [url, setUrl] = useState<string>('')
  const [loopback, setLoopback] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let dead = false
    void joinUrl(roomId).then((u) => {
      if (dead) return
      setUrl(u)
      setLoopback(isLoopbackUrl(u))
    })
    return () => {
      dead = true
    }
  }, [roomId])

  useEffect(() => {
    if (!canvasRef.current || !url) return
    void QRCode.toCanvas(canvasRef.current, url, {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
  }, [url])

  useEffect(() => {
    let dead = false
    async function poll() {
      const r = await getRoom(roomId)
      if (dead || !r) return
      setRoom(r)
    }
    void poll()
    const t = setInterval(poll, 1000)
    return () => {
      dead = true
      clearInterval(t)
    }
  }, [roomId])

  async function onStart() {
    setStarting(true)
    setErr(null)
    const r = await startRoom(roomId, hostToken)
    setStarting(false)
    if (!r) {
      setErr('Could not start — is the server up?')
      return
    }
    setRoom(r)
  }

  async function onCloseRoom() {
    setClosing(true)
    setErr(null)
    await closeRoom(roomId, hostToken)
    setClosing(false)
    sessionStorage.removeItem(`pnp.host.${roomId}`)
    onBack()
  }

  const count = room?.count ?? 0
  const live = room?.status === 'live'
  const locked = room?.status === 'closed' || room?.status === 'ended'

  return (
    <div className="screen host-lobby">
      <header className="host-head">
        <div>
          <p className="label">HOST · ONE ROUND</p>
          <h1 className="host-title">Plug-N-Pay</h1>
        </div>
        <div className="host-code-block">
          <span className="label">ROOM</span>
          <span className="num host-code">{roomId}</span>
        </div>
      </header>

      {loopback && (
        <div className="host-warn">
          This QR points at <span className="num">localhost</span> — other phones cannot open it.
          Deploy on Render and open the host lobby from the Render URL (or, on the same Wi‑Fi,
          open this page via your LAN address, e.g. <span className="num">http://192.168.x.x:5174</span>).
        </div>
      )}

      <div className="host-body">
        <div className="host-qr-panel">
          <canvas ref={canvasRef} />
          <p className="label">{live || locked ? 'ROOM LOCKED' : 'SCAN TO JOIN'}</p>
          <p className="num host-url">{url ? url.replace(/^https?:\/\//, '') : '…'}</p>
        </div>

        <aside className="host-side">
          <div className="host-stat">
            <span className="num host-stat-value">{count}</span>
            <span className="label">{live ? 'PLAYERS IN ROUND' : 'PLAYERS WAITING'}</span>
          </div>

          <ol className="host-players">
            {(room?.players ?? []).length === 0 && (
              <li className="host-player empty">Waiting for the first scan…</li>
            )}
            {(room?.players ?? []).map((p) => (
              <li key={p.deviceId} className="host-player">
                <span
                  className="host-swatch"
                  style={{ background: `hsl(${p.hue} 40% 45%)` }}
                  aria-hidden
                />
                <span className="num">{p.nick}</span>
                <span className="label">{p.carName}</span>
              </li>
            ))}
          </ol>

          <div className="host-actions">
            {live ? (
              <>
                <p className="live-note">ROUND LIVE — joins are locked</p>
                <button
                  className="primary"
                  onClick={() => {
                    if (!url) return
                    const wall = new URL(url)
                    wall.hash = 'wall'
                    window.open(wall.toString(), '_blank')
                  }}
                >
                  Open Standings Wall
                </button>
              </>
            ) : locked ? (
              <p className="degraded-note">ROOM CLOSED — no further joins</p>
            ) : (
              <button
                className="primary host-start"
                onClick={() => void onStart()}
                disabled={starting || count === 0 || loopback}
              >
                {loopback
                  ? 'Fix URL first'
                  : starting
                    ? 'Starting…'
                    : count === 0
                      ? 'Waiting for players'
                      : `Start Round · ${count}`}
              </button>
            )}
            {err && <p className="landing-error">{err}</p>}
            <button
              className="host-back"
              onClick={() => void onCloseRoom()}
              disabled={closing}
            >
              {closing ? 'Closing…' : live ? 'End Round & Leave' : 'Close Room'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
