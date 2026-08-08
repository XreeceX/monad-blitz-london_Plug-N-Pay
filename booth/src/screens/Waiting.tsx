// Player waiting lobby — joined via QR, held until the host hits START.

import { useEffect, useRef, useState } from 'react'
import { Car } from '../components/Car'
import { getRoom, joinRoom } from '../net/room'
import type { CarSpec } from '../game/cars'

interface Props {
  roomId: string
  deviceId: string
  nickname: string
  car: CarSpec
  onStart: () => void
  onLeave: () => void
}

export function Waiting({ roomId, deviceId, nickname, car, onStart, onLeave }: Props) {
  const [count, setCount] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockReason, setLockReason] = useState('Host closed this room — joins are locked.')
  const fired = useRef(false)
  const admitted = useRef(false)

  useEffect(() => {
    let dead = false
    fired.current = false
    admitted.current = false

    async function tick() {
      const joined = await joinRoom(roomId, {
        deviceId,
        nickname,
        carId: car.id,
        carName: car.name,
        hue: car.hue,
      })
      if (dead) return

      if (joined) {
        admitted.current = true
        setFailed(false)
        setLocked(false)
        setCount(joined.count)
        if (joined.status === 'live' && !fired.current) {
          fired.current = true
          onStart()
        }
        return
      }

      const r = await getRoom(roomId)
      if (dead) return
      if (!r) {
        setFailed(true)
        setLocked(false)
        return
      }

      setFailed(false)
      setCount(r.count)

      if (r.status === 'closed' || r.status === 'ended') {
        setLockReason('Host closed this room — joins are locked. Ask them to open a new lobby.')
        setLocked(true)
        return
      }

      const inRoster = r.players.some((p) => p.deviceId === deviceId)
      if (r.status === 'live') {
        if ((admitted.current || inRoster) && !fired.current) {
          fired.current = true
          onStart()
          return
        }
        if (!admitted.current && !inRoster) {
          setLockReason('Round already started — this room is locked.')
          setLocked(true)
        }
      }
    }

    void tick()
    const t = setInterval(() => void tick(), 800)
    return () => {
      dead = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, deviceId, nickname, car.id])

  return (
    <div className="screen waiting">
      <p className="label">ROOM {roomId}</p>
      <div className="waiting-car">
        <Car spec={car} />
      </div>
      <p className="waiting-nick num">{nickname}</p>
      <p className="plate-chip num">
        {car.name} · {car.plateKwh} kWh
      </p>

      {failed ? (
        <>
          <p className="landing-error">
            Room not found — check the code or ask the host to open a new one.
          </p>
          <button className="primary" onClick={onLeave}>
            Back to start
          </button>
        </>
      ) : locked ? (
        <>
          <p className="landing-error">{lockReason}</p>
          <button className="primary" onClick={onLeave}>
            Back to start
          </button>
        </>
      ) : (
        <>
          <p className="waiting-status">
            Waiting for the host to start
            <span className="waiting-dots" aria-hidden>
              …
            </span>
          </p>
          <p className="num waiting-count">{count ?? '—'} in the lobby</p>
        </>
      )}

      <p className="waiting-terms muted">
        Top 10 share 20% of any cash prize we win — nothing if we don't place. Multiple
        fingers are allowed. One round.
      </p>
    </div>
  )
}
