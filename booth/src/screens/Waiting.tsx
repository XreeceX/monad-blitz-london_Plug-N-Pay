// Player waiting lobby — joined via QR, held until the host hits START.

import { useEffect, useRef, useState } from 'react'
import { Car } from '../components/Car'
import { getRoom, joinRoom, type RoomState } from '../net/room'
import type { CarSpec } from '../game/cars'

interface Props {
  roomId: string
  deviceId: string
  nickname: string
  car: CarSpec
  onStart: () => void
}

export function Waiting({ roomId, deviceId, nickname, car, onStart }: Props) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [failed, setFailed] = useState(false)
  const fired = useRef(false)

  useEffect(() => {
    let dead = false
    fired.current = false

    async function tick() {
      const joined = await joinRoom(roomId, {
        deviceId,
        nickname,
        carId: car.id,
        carName: car.name,
        hue: car.hue,
      })
      const r = joined ?? (await getRoom(roomId))
      if (dead) return
      if (!r) {
        setFailed(true)
        return
      }
      setFailed(false)
      setRoom(r)
      if (r.status === 'live' && !fired.current) {
        fired.current = true
        onStart()
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
        <p className="landing-error">
          Room not found — check the code or ask the host to open a new one.
        </p>
      ) : (
        <>
          <p className="waiting-status">
            Waiting for the host to start
            <span className="waiting-dots" aria-hidden>
              …
            </span>
          </p>
          <p className="num waiting-count">{room?.count ?? '—'} in the lobby</p>
        </>
      )}

      <p className="waiting-terms muted">
        Top 10 share 20% of any cash prize we win — nothing if we don't place. Multiple
        fingers are allowed. One round.
      </p>
    </div>
  )
}
