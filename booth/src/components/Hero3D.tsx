// Landing hero — a charging bay in CSS 3D over one SVG scene.
//
// Deliberately not WebGL: the booth runs on whatever phones and laptops are in
// the room, and a 150 KB renderer plus a GL context per device buys nothing a
// perspective transform cannot draw here.
//
// Post, cable and car share ONE viewBox. That is the whole point of the file:
// the cable's end is computed from the car's port rather than positioned to
// look about right, so it connects at every window size instead of at the one
// the numbers were tuned against. preserveAspectRatio centres the scene.

import { useEffect, useRef } from 'react'
import { Car, CAR_W, CAR_H, carPortPoint } from './Car'
import { carFromDeviceId } from '../game/cars'

// A fixed seed, so the frontpage car is the same one on every projector.
const HERO_CAR = carFromDeviceId('plug-n-pay-booth-hero')

// Scene space. Everything below is in these units.
// The viewBox is cropped tight to the content (which spans y 120..442) rather
// than padded out: `meet` scales to fit, so dead space at the top and bottom
// would shrink the whole bay for no reason.
const VW = 1000
const VB_Y = 110
const VB_H = 340

// The car is top-down art. Squashing it vertically is what tipping it onto the
// ground plane looks like — cos(55°) ≈ 0.57 — and unlike a CSS rotateX it
// leaves every point computable.
const CAR_SCALE = 1.62
const GROUND_SQUASH = 0.57
const CAR_LEFT = 545
const CAR_TOP = 205

const POST_X = 268
const POST_TOP = 132

// Where the lead leaves the post, and where it has to arrive.
const NOZZLE = { x: POST_X + 46, y: POST_TOP + 128 }
const localPort = carPortPoint(HERO_CAR)
const PORT = {
  x: CAR_LEFT + localPort.x * CAR_SCALE,
  y: CAR_TOP + localPort.y * CAR_SCALE * GROUND_SQUASH,
}

// A hanging lead: leaves the post falling, arrives at the port flat.
const CABLE = [
  `M ${NOZZLE.x} ${NOZZLE.y}`,
  `C ${NOZZLE.x + 54} ${NOZZLE.y + 118},`,
  `${PORT.x - 150} ${PORT.y + 46},`,
  `${PORT.x} ${PORT.y}`,
].join(' ')

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
      tx = (e.clientY / window.innerHeight - 0.5) * -4
      ty = (e.clientX / window.innerWidth - 0.5) * 7
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

        <svg
          className="hero3d-scene"
          viewBox={`0 ${VB_Y} ${VW} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="heroPostFace" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3A3A3E" />
              <stop offset="0.5" stopColor="#232327" />
              <stop offset="1" stopColor="#141417" />
            </linearGradient>
            <radialGradient id="heroSpill" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#0A84FF" stopOpacity="0.4" />
              <stop offset="1" stopColor="#0A84FF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Light spill on the ground under each object. */}
          <ellipse cx={POST_X + 46} cy={POST_TOP + 216} rx={132} ry={40} fill="url(#heroSpill)" />
          <ellipse
            cx={CAR_LEFT + (CAR_W * CAR_SCALE) / 2}
            cy={CAR_TOP + CAR_H * CAR_SCALE * GROUND_SQUASH}
            rx={150}
            ry={34}
            fill="url(#heroSpill)"
            opacity={0.7}
          />

          <g className="hero3d-post" transform={`translate(${POST_X}, ${POST_TOP})`}>
            {/* plinth */}
            <ellipse cx={46} cy={214} rx={54} ry={13} fill="#000" opacity={0.5} />
            <rect x={18} y={168} width={56} height={48} rx={6} fill="#1A1A1D" />
            <rect x={4} y={156} width={84} height={16} rx={8} fill="#2A2A2E" />
            {/* column */}
            <rect x={12} y={0} width={68} height={158} rx={18} fill="url(#heroPostFace)" stroke="rgba(255,255,255,0.12)" />
            <rect x={20} y={8} width={26} height={142} rx={13} fill="#fff" opacity={0.05} />
            {/* screen */}
            <rect x={24} y={18} width={44} height={52} rx={9} fill="#04070C" stroke="rgba(255,255,255,0.1)" />
            <rect className="hero3d-post-read" x={31} y={30} width={30} height={5} rx={2.5} fill="var(--cyan)" />
            <rect x={31} y={42} width={18} height={4} rx={2} fill="var(--cyan-dim)" />
            {/* socket */}
            <circle cx={46} cy={104} r={16} fill="#04070C" stroke="rgba(255,255,255,0.1)" />
            <circle className="hero3d-post-led" cx={46} cy={104} r={10} fill="none" stroke="var(--cyan)" strokeWidth={3} />
            <circle cx={46} cy={104} r={3.5} fill="var(--cyan-hot)" />
          </g>

          {/* Slack lead, then the charge travelling along it. */}
          <path className="hero3d-cable-slack" d={CABLE} fill="none" stroke="#2B3A47" strokeWidth={7} strokeLinecap="round" />
          <path d={CABLE} fill="none" stroke="var(--cyan-dim)" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
          <path className="hero3d-cable-flow" d={CABLE} fill="none" stroke="var(--cyan-hot)" strokeWidth={3.5} strokeLinecap="round" />

          {/* The connector, seated in the port. */}
          <g transform={`translate(${PORT.x}, ${PORT.y})`}>
            <rect x={-19} y={-9} width={26} height={18} rx={5} fill="#2A2A2E" stroke="rgba(255,255,255,0.14)" />
            <circle cx={2} cy={0} r={4} fill="var(--cyan-hot)" />
          </g>

          <g
            className="hero3d-car"
            transform={`translate(${CAR_LEFT}, ${CAR_TOP}) scale(${CAR_SCALE}, ${CAR_SCALE * GROUND_SQUASH})`}
          >
            <Car spec={HERO_CAR} fill={0.62} showPort />
          </g>
        </svg>
      </div>
    </div>
  )
}
