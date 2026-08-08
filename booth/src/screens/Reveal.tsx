// Car reveal — booth spec §3.2. Input is live from 0ms: any touch
// fast-forwards to the composed state. The reveal never holds a player hostage.

import { useEffect, useRef, useState } from 'react'
import { Car } from '../components/Car'
import type { CarSpec } from '../game/cars'

interface Props {
  car: CarSpec
  nickname: string
  onDone: () => void
}

const REVEAL_MS = 2100

export function Reveal({ car, nickname, onDone }: Props) {
  const [skipped, setSkipped] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
    }, skipped ? 350 : REVEAL_MS)
    return () => clearTimeout(t)
  }, [skipped, onDone])

  return (
    <div
      className={`screen reveal no-touch-ui${skipped ? ' reveal-skipped' : ''}`}
      onPointerDown={() => setSkipped(true)}
    >
      <div className="reveal-stage">
        <div className="reveal-sweep" aria-hidden />
        <div className="reveal-car">
          <Car spec={car} flourish />
        </div>
      </div>
      <div className="reveal-plate">
        <span className="plate-name">{car.name}</span>
        <span className="plate-sub num">
          {car.plateKwh} kWh · {car.rarity.toUpperCase()}
        </span>
        <span className="plate-nick label">{nickname}</span>
      </div>
    </div>
  )
}
