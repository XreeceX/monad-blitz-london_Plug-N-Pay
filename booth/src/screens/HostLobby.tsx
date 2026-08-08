// Host screen for the presentation — QR up, watch joiners, start once.

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { getRoom, joinUrl, startRoom, type RoomState } from '../net/room'

interface Props {
  roomId: string
  hostToken: string
  onBack: () => void
}

export function HostLobby({ roomId, hostToken, onBack }: Props) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [starting, setStarting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const url = joinUrl(roomId)

  useEffect(() => {
    if (!canvasRef.current) return
    void QRCode.toCanvas(canvasRef.current, url, {
      width: 280,
      margin: 2,
      color: { dark: '#06090C', light: '#DFE9ED' },
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

  const count = room?.count ?? 0
  const live = room?.status === 'live'

  return (
    <div className="screen host-lobby">
      <header className="host-head">
        <div>
          <p className="label">HOST · ONE ROUND</p>
          <h1 className="host-title">PLUG-N-PAY</h1>
        </div>
        <div className="host-code-block">
          <span className="label">ROOM</span>
          <span className="num host-code">{roomId}</span>
        </div>
      </header>

      <div className="host-body">
        <div className="host-qr-panel">
          <canvas ref={canvasRef} />
          <p className="label">SCAN TO JOIN</p>
          <p className="num host-url">{url.replace(/^https?:\/\//, '')}</p>
        </div>

        <aside className="host-side">
          <div className="host-stat">
            <span className="num host-stat-value">{count}</span>
            <span className="label">PLAYERS WAITING</span>
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
                <p className="live-note">ROUND LIVE — every phone is in the game</p>
                <button
                  className="primary"
                  onClick={() => {
                    window.open(`${window.location.pathname}?room=${roomId}#wall`, '_blank')
                  }}
                >
                  OPEN STANDINGS WALL
                </button>
              </>
            ) : (
              <button
                className="primary host-start"
                onClick={() => void onStart()}
                disabled={starting || count === 0}
              >
                {starting ? 'STARTING…' : count === 0 ? 'WAITING FOR PLAYERS' : `START ROUND · ${count}`}
              </button>
            )}
            {err && <p className="landing-error">{err}</p>}
            <button className="host-back" onClick={onBack}>
              CLOSE LOBBY
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
