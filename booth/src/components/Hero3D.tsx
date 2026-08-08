// Landing hero — a charging bay rendered in CSS 3D.
//
// Deliberately not WebGL: the booth runs on whatever phones and laptops are in
// the room, and a 150 KB renderer plus a GL context per device buys nothing a
// perspective transform cannot draw here. Everything below is composited —
// transforms and opacity only, no per-frame layout (§10).
//
// The car art is top-down, so laying it flat on the ground plane with the same
// rotateX as the floor puts it in the scene for free. The post stays upright.

import { useEffect, useRef } from 'react'
import { Car } from './Car'
import { carFromDeviceId } from '../game/cars'

// A fixed seed, so the frontpage car is the same one on every projector.
const HERO_CAR = carFromDeviceId('plug-n-pay-booth-hero')

export function Hero3D() {
  const worldRef = useRef<HTMLDivElement>(null)

  // Pointer parallax. One rAF-coalesced write of two custom properties —
  // the browser recomposites, nothing re-lays-out.
  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let tx = 0
    let ty = 0

    const apply = () => {
      raf = 0
      world.style.setProperty('--tilt-x', `${tx.toFixed(2)}deg`)
      world.style.setProperty('--tilt-y', `${ty.toFixed(2)}deg`)
    }

    const onMove = (e: PointerEvent) => {
      // −1..1 from centre, then a shallow tilt. Big angles read as a gimmick.
      tx = (e.clientY / window.innerHeight - 0.5) * -5
      ty = (e.clientX / window.innerWidth - 0.5) * 9
      if (!raf) raf = requestAnimationFrame(apply)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="hero3d" aria-hidden>
      <div ref={worldRef} className="hero3d-world">
        <div className="hero3d-horizon" />

        <div className="hero3d-floor">
          <div className="hero3d-grid" />
        </div>

        <div className="hero3d-pool" />

        {/* Upright pillar, side-on. */}
        <div className="hero3d-post">
          <svg viewBox="0 0 60 150" width="60" height="150">
            <rect x="8" y="4" width="44" height="96" rx="10" fill="var(--mat-thick)" stroke="var(--mat-line)" />
            <rect x="16" y="14" width="28" height="34" rx="6" fill="#04070C" stroke="var(--mat-line)" />
            <rect className="hero3d-post-read" x="20" y="22" width="20" height="4" rx="2" fill="var(--cyan)" />
            <circle className="hero3d-post-led" cx="30" cy="70" r="7" fill="none" stroke="var(--cyan)" strokeWidth="2.5" />
            <circle cx="30" cy="70" r="2.5" fill="var(--cyan-hot)" />
            <rect x="4" y="100" width="52" height="8" rx="4" fill="var(--surface-2)" />
            <rect x="14" y="108" width="32" height="38" rx="4" fill="var(--surface)" />
          </svg>
        </div>

        {/* Energy arc, post → port. Dash travel is the only thing moving. */}
        <svg className="hero3d-cable" viewBox="0 0 400 220" preserveAspectRatio="none">
          {/* The box is stretched to fit the scene, so the stroke has to opt
              out of that scale or it renders as a lopsided smear. */}
          <path className="hero3d-cable-slack" d="M 24 40 C 90 130, 150 176, 268 168" fill="none" stroke="var(--cyan-dim)" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path className="hero3d-cable-flow" d="M 24 40 C 90 130, 150 176, 268 168" fill="none" stroke="var(--cyan-hot)" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Top-down art laid onto the ground plane. */}
        <div className="hero3d-car">
          <Car spec={HERO_CAR} fill={0.62} showPort />
        </div>
      </div>
    </div>
  )
}
