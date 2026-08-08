// Handshake — booth spec §3.4, honesty per FR-ID-2 and FR-SPLIT-2:
// modelled on ISO 15118, labelled simulated, and no real-looking
// addresses that a developer could try to verify.

import { useEffect } from 'react'
import type { CarSpec } from '../game/cars'

interface Props {
  car: CarSpec
  onDone: () => void
}

export function Handshake({ car, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="screen handshake no-touch-ui" onPointerDown={onDone}>
      <div className="handshake-row">
        <span className="cert cert-car num">VEHICLE · SIM-{car.id.slice(0, 4).toUpperCase()}</span>
        <span className="cert-link" aria-hidden>
          ⟝⟞
        </span>
        <span className="cert cert-station num">STATION · SIM-C91E</span>
      </div>
      <p className="handshake-caption">PLUG &amp; CHARGE · CONTRACT CERT VERIFIED</p>
      <p className="handshake-sub">ISO 15118-style handshake — simulated for this demo</p>
    </div>
  )
}
