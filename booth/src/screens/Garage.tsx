// Garage and hold-to-drag plug — booth spec §3.3.
// Must grab the connector, hold, and drag it onto the car port. Misses spring
// home with no error text. Overlay chrome never steals the gesture.

import { useEffect, useRef, useState } from 'react'
import { Car, CAR_W, CAR_H, carPortPoint } from '../components/Car'
import { ChargePost } from '../components/ChargePost'
import { cableD, type Pt } from '../components/Cable'
import { onFrame } from '../game/loop'
import { unlockAudio, thunk } from '../audio/synth'
import type { CarSpec } from '../game/cars'

interface Props {
  car: CarSpec
  nickname: string
  onPlugged: () => void
}

const MAGNET_PX = 72
const COMMIT_PX = 56
const HIT_PX = 120
const FOLLOW = 0.18
const MAGNET_LERP = 0.28

export function Garage({ car, nickname, onPlugged }: Props) {
  const [latched, setLatched] = useState(false)
  const [holding, setHolding] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const cableRef = useRef<SVGPathElement>(null)
  const connectorRef = useRef<SVGGElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const pipRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const svg = svgRef.current
    const cable = cableRef.current
    const connector = connectorRef.current
    if (!root || !svg || !cable || !connector) return
    const rootEl = root
    const svgEl = svg

    const w = rootEl.clientWidth
    const h = rootEl.clientHeight
    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`)

    const carScale = Math.min(1.35, (h * 0.48) / CAR_H)
    const carX = w / 2 - (CAR_W * carScale) / 2
    const carY = h * 0.08
    const localPort = carPortPoint(car)
    const port: Pt = { x: carX + localPort.x * carScale, y: carY + localPort.y * carScale }

    const postScale = 1.5
    const postX = Math.max(w * 0.2, 56)
    const postG = svgEl.querySelector<SVGGElement>('.garage-post')
    postG?.setAttribute('transform', `translate(${postX}, ${h - 6}) scale(${postScale})`)
    const station: Pt = { x: postX, y: h - 6 - 24 * postScale }
    // Holster sits clear of the terms strip — thumb reach, centre-bottom.
    const holster: Pt = { x: w * 0.55, y: h - 168 }

    const carG = svgEl.querySelector<SVGGElement>('.garage-car')
    carG?.setAttribute('transform', `translate(${carX}, ${carY}) scale(${carScale})`)

    const bay = svgEl.querySelector<SVGPathElement>('.bay-lines')
    if (bay) {
      const bx = carX - 18
      const by = carY - 12
      const bw = CAR_W * carScale + 36
      const bh = CAR_H * carScale + 24
      const arm = 26
      bay.setAttribute(
        'd',
        [
          `M ${bx} ${by + arm} L ${bx} ${by} L ${bx + arm} ${by}`,
          `M ${bx + bw - arm} ${by} L ${bx + bw} ${by} L ${bx + bw} ${by + arm}`,
          `M ${bx} ${by + bh - arm} L ${bx} ${by + bh} L ${bx + arm} ${by + bh}`,
          `M ${bx + bw - arm} ${by + bh} L ${bx + bw} ${by + bh} L ${bx + bw} ${by + bh - arm}`,
        ].join(' '),
      )
    }

    const pos = { ...holster }
    const c1 = { x: station.x, y: station.y - 40 }
    const c2 = { x: holster.x, y: holster.y + 60 }
    let dragging = false
    let pointerId: number | null = null
    let springT = -1
    const springFrom = { ...holster }
    let done = false
    let pipP = -1
    const target = { ...holster }

    const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

    const toSvg = (e: PointerEvent): Pt => {
      const r = svgEl.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    function latch() {
      if (done) return
      done = true
      dragging = false
      pointerId = null
      setHolding(false)
      pos.x = port.x
      pos.y = port.y
      setLatched(true)
      unlockAudio()
      setTimeout(() => {
        carG?.classList.add('chassis-dip')
      }, 80)
      setTimeout(() => {
        thunk()
        navigator.vibrate?.(12)
      }, 100)
      setTimeout(() => {
        ringRef.current?.classList.add('flare')
      }, 150)
      setTimeout(() => {
        pipP = 0
        rootEl.classList.add('show-mon-panel')
      }, 200)
      setTimeout(onPlugged, 1050)
    }

    function down(e: PointerEvent) {
      if (done || dragging) return
      // Only the plug is grabable — tapping elsewhere does nothing.
      const p = toSvg(e)
      if (dist(p, pos) > HIT_PX) return
      e.preventDefault()
      dragging = true
      pointerId = e.pointerId
      springT = -1
      setHolding(true)
      try {
        rootEl.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      target.x = p.x
      target.y = p.y
      // Snap plug under the thumb immediately so the hold feels physical.
      pos.x = p.x
      pos.y = p.y
    }

    function move(e: PointerEvent) {
      if (!dragging || e.pointerId !== pointerId) return
      e.preventDefault()
      const p = toSvg(e)
      target.x = p.x
      target.y = p.y
    }

    function up(e: PointerEvent) {
      if (!dragging || e.pointerId !== pointerId) return
      dragging = false
      pointerId = null
      setHolding(false)
      try {
        rootEl.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      // Must release on (or very near) the port — no auto-snap mid-drag.
      if (dist(pos, port) <= COMMIT_PX || dist(target, port) <= COMMIT_PX) {
        latch()
      } else {
        springT = 0
        springFrom.x = pos.x
        springFrom.y = pos.y
        ringRef.current?.classList.remove('flare')
        const portG = svgEl.querySelector('.garage-port-ring')
        portG?.classList.remove('not-yet')
        void (portG as SVGElement | null)?.getBoundingClientRect()
        portG?.classList.add('not-yet')
      }
    }

    const opts: AddEventListenerOptions = { passive: false }
    rootEl.addEventListener('pointerdown', down, opts)
    rootEl.addEventListener('pointermove', move, opts)
    rootEl.addEventListener('pointerup', up, opts)
    rootEl.addEventListener('pointercancel', up, opts)

    const stop = onFrame((_, dtMs) => {
      const dt = Math.min(dtMs, 50) / 16.7

      if (dragging) {
        // Soft magnet assists aim near the port, but never finishes the latch.
        if (dist(target, port) < MAGNET_PX) {
          const pull = { x: target.x + (port.x - target.x) * 0.45, y: target.y + (port.y - target.y) * 0.45 }
          pos.x += (pull.x - pos.x) * MAGNET_LERP * dt
          pos.y += (pull.y - pos.y) * MAGNET_LERP * dt
        } else {
          pos.x += (target.x - pos.x) * 0.65 * dt
          pos.y += (target.y - pos.y) * 0.65 * dt
        }
      } else if (springT >= 0) {
        springT += dtMs
        const k = Math.min(springT / 550, 1)
        const ease = 1 - Math.pow(1 - k, 2) * Math.cos(k * Math.PI * 1.5)
        pos.x = springFrom.x + (holster.x - springFrom.x) * ease
        pos.y = springFrom.y + (holster.y - springFrom.y) * ease
        if (k >= 1) springT = -1
      }

      const slack = done ? 24 : Math.max(30, 90 - dist(pos, station) * 0.15)
      const c1t = { x: station.x, y: station.y - slack }
      const c2t = { x: pos.x, y: pos.y + slack }
      c1.x += (c1t.x - c1.x) * FOLLOW * dt
      c1.y += (c1t.y - c1.y) * FOLLOW * dt
      c2.x += (c2t.x - c2.x) * FOLLOW * dt
      c2.y += (c2t.y - c2.y) * FOLLOW * dt
      cable.setAttribute('d', cableD(station, c1, c2, pos))

      const angle = done ? Math.atan2(port.y - c2.y, port.x - c2.x) * (180 / Math.PI) + 90 : 0
      const scale = dragging ? 1.12 : 1
      connector.setAttribute(
        'transform',
        `translate(${pos.x}, ${pos.y}) rotate(${angle}) scale(${scale})`,
      )

      if (pipP >= 0 && pipRef.current) {
        pipP += dtMs / 700
        if (pipP >= 1) {
          pipP = -1
          pipRef.current.style.opacity = '0'
        } else {
          try {
            const len = cable.getTotalLength()
            const pt = cable.getPointAtLength(pipP * len)
            pipRef.current.style.opacity = '1'
            pipRef.current.setAttribute('cx', pt.x.toFixed(1))
            pipRef.current.setAttribute('cy', pt.y.toFixed(1))
          } catch {
            /* path not ready */
          }
        }
      }

      ringRef.current?.setAttribute(
        'stroke',
        dragging && dist(pos, port) < MAGNET_PX ? 'var(--cyan)' : 'var(--cyan-dim)',
      )
    })

    return () => {
      stop()
      rootEl.removeEventListener('pointerdown', down)
      rootEl.removeEventListener('pointermove', move)
      rootEl.removeEventListener('pointerup', up)
      rootEl.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car])

  const localPort = carPortPoint(car)

  return (
    <div
      ref={rootRef}
      className={`screen garage no-touch-ui${latched ? ' latched' : ''}${holding ? ' holding' : ''}`}
    >
      <div className="garage-head garage-chrome">
        <span className="nick-chip num">{nickname}</span>
        <span className="plate-chip num">
          {car.name} · {car.plateKwh} kWh
        </span>
      </div>

      <svg ref={svgRef} className="garage-svg connector">
        <path className="bay-lines" fill="none" stroke="var(--line)" strokeWidth={2} />
        <g className="garage-car">
          <Car spec={car} />
          <g className="garage-port-ring" transform={`translate(${localPort.x}, ${localPort.y})`}>
            <circle ref={ringRef} r={9} fill="none" stroke="var(--cyan-dim)" strokeWidth={2.5} />
            <circle className="flare-ring" r={9} fill="none" stroke="var(--cyan)" strokeWidth={2} opacity={0} />
          </g>
        </g>

        <g className="garage-post">
          <ChargePost x={0} y={0} />
        </g>

        <path ref={cableRef} className="cable" fill="none" stroke="var(--cyan-dim)" strokeWidth={5} strokeLinecap="round" />
        <circle ref={pipRef} className="pip" r={4} fill="var(--cyan-hot)" opacity={0} />

        <g ref={connectorRef} className="connector-g">
          {/* Invisible fat hit target for thumbs */}
          <circle className="connector-hit" r={56} fill="transparent" />
          <circle className="connector-glow" r={28} fill="var(--cyan)" opacity={0.12} />
          <rect x={-14} y={-32} width={28} height={44} rx={7} fill="var(--surface)" stroke="var(--cyan)" strokeWidth={2.5} />
          <rect x={-7} y={-40} width={14} height={14} rx={3} fill="var(--cyan)" />
        </g>
      </svg>

      <div className="mon-panel num" aria-hidden>
        RATE 0.12 MON / kWh · SELL-BACK 0.30
      </div>

      {!latched && (
        <div className="garage-hint">
          <span className="hint-chevron" aria-hidden>
            ▲
          </span>
          <span className="label">
            {holding ? 'DROP ON THE PORT' : 'HOLD THE PLUG · DRAG TO THE CAR'}
          </span>
        </div>
      )}

      <p className="garage-terms garage-chrome">
        Top 10 share 20% of any cash prize we win — nothing if we don't place. Full
        terms on the leaderboard. Multiple fingers are allowed.
      </p>
    </div>
  )
}
