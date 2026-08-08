// Charging — booth spec §3.5, §3.6.
// The screen someone hammers without looking away. Three things never move:
// the tap zone, the car, and the counter. All live numbers are written
// straight to the DOM inside the single rAF loop; React state changes only
// on phase transitions.

import { useEffect, useRef, useState } from 'react'
import { Car, CAR_W, CAR_H, carPortPoint } from '../components/Car'
import { cableD, PipStream } from '../components/Cable'
import { fmtWh, fmtMon } from '../components/Counter'
import { createEngine, type EngineSnapshot } from '../game/engine'
import { onFrame } from '../game/loop'
import {
  SESSION_MS,
  MAX_POINTERS,
  P_MAX_KW,
  TAPER_START_SOC,
  TICK_REPORT_MS,
} from '../game/constants'
import { enqueueTick, flushOnHide, type SessionConfig } from '../net/relay'
import { flipSound, chime } from '../audio/synth'
import type { CarSpec } from '../game/cars'
import type { RunResult } from '../state/session'

interface Props {
  car: CarSpec
  session: SessionConfig | null
  onEnd: (result: Omit<RunResult, 'rank' | 'top'>) => void
}

const RIPPLE_POOL = 8
/** Bay floor grid pitch, px. The scroll wraps on this so the seam never shows. */
const BAY_TILE = 72

export function Charging({ car, session, onEnd }: Props) {
  const [phase, setPhase] = useState<'charge' | 'v2g'>('charge')
  const [flash, setFlash] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLSpanElement>(null)
  const heroLabelRef = useRef<HTMLSpanElement>(null)
  const monRef = useRef<HTMLSpanElement>(null)
  const kwRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<SVGRectElement | null>(null)
  const surgeRef = useRef<HTMLDivElement>(null)
  const countdownRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const cablePathRef = useRef<SVGPathElement>(null)
  const bayGridRef = useRef<HTMLDivElement>(null)
  const bayGlowRef = useRef<HTMLDivElement>(null)

  const endedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  useEffect(() => {
    const root = rootRef.current
    const svg = svgRef.current
    const cablePath = cablePathRef.current
    if (!root || !svg || !cablePath) return

    const engine = createEngine(performance.now(), session?.surgeWindows)

    // ---- static scene geometry ----
    const stage = svg.parentElement as HTMLElement
    const w = stage.clientWidth
    const h = stage.clientHeight
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    const carScale = Math.min(1, (h * 0.86) / CAR_H)
    const carX = w * 0.58 - (CAR_W * carScale) / 2
    const carY = (h - CAR_H * carScale) / 2
    svg.querySelector('.charging-car')?.setAttribute(
      'transform',
      `translate(${carX}, ${carY}) scale(${carScale})`,
    )
    const localPort = carPortPoint(car)
    const port = { x: carX + localPort.x * carScale, y: carY + localPort.y * carScale }
    const anchor = { x: 10, y: h - 6 }
    cablePath.setAttribute(
      'd',
      cableD(
        anchor,
        { x: anchor.x + 10, y: anchor.y - h * 0.5 },
        { x: port.x - 60, y: port.y + 30 },
        port,
      ),
    )
    fillRef.current = svg.querySelector<SVGRectElement>('.car-fill')

    const pipEls = Array.from(svg.querySelectorAll<SVGCircleElement>('.stream-pip'))
    const stream = new PipStream(cablePath, pipEls)
    stream.speedPerSec = 0.9

    // ---- input: whole screen is the tap pad (multi-touch, up to 5) ----
    const pointers = new Set<number>()
    const ripples = Array.from(root.querySelectorAll<HTMLDivElement>('.ripple'))
    let rippleIdx = 0

    // Arrow, not a hoisted `function` — a function declaration can be called
    // before the null guard above, so TypeScript drops the narrowing on `root`.
    const onDown = (e: PointerEvent) => {
      if (endedRef.current) return
      // Ignore secondary buttons; every finger counts.
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      if (pointers.has(e.pointerId)) return
      if (pointers.size >= MAX_POINTERS) return
      pointers.add(e.pointerId)
      try {
        root.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      engine.tap(e.timeStamp || performance.now())
      const rp = ripples[rippleIdx++ % RIPPLE_POOL]
      if (rp) {
        const r = root.getBoundingClientRect()
        rp.style.left = `${e.clientX - r.left}px`
        rp.style.top = `${e.clientY - r.top}px`
        rp.classList.remove('rippling')
        void rp.offsetWidth
        rp.classList.add('rippling')
      }
    }
    function onUp(e: PointerEvent) {
      pointers.delete(e.pointerId)
    }
    const opts: AddEventListenerOptions = { passive: false }
    root.addEventListener('pointerdown', onDown, opts)
    root.addEventListener('pointerup', onUp, opts)
    root.addEventListener('pointercancel', onUp, opts)
    const blockGesture = (ev: Event) => ev.preventDefault()
    // Stop iOS from treating multi-finger taps as page gestures.
    root.addEventListener('gesturestart', blockGesture, opts)

    // ---- wake lock (§11): request now, reacquire on visibility ----
    let lock: WakeLockSentinel | null = null
    const getLock = () => {
      navigator.wakeLock
        ?.request('screen')
        .then((l) => {
          lock = l
        })
        .catch(() => {})
    }
    getLock()
    const onVis = () => {
      if (document.visibilityState === 'visible') getLock()
      else flushOnHide()
    }
    document.addEventListener('visibilitychange', onVis)

    // ---- tick reporting, ~1/s, fire-and-forget (§8) ----
    const tickTimer = setInterval(() => {
      if (!endedRef.current) enqueueTick(engine.drainTick())
    }, TICK_REPORT_MS)

    // ---- per-frame ----
    let flipped = false
    let lastCountdown = -1
    let surgeOn = false
    let bayScroll = 0

    const stop = onFrame((now, dtMs) => {
      if (endedRef.current) return
      const s: EngineSnapshot = engine.update(now)

      // Energy stays the hero throughout — charged-and-paid is the story,
      // V2G is an added bonus (team decision 2026-08-08, supersedes §3.6's
      // hero swap). After the Flip the hero keeps climbing as total Wh moved.
      if (heroRef.current && monRef.current && heroLabelRef.current) {
        if (s.phase === 'v2g') {
          heroRef.current.textContent = fmtWh(s.whCharged + s.whDischarged)
          heroLabelRef.current.textContent = 'Wh MOVED'
          monRef.current.textContent = `−${fmtMon(s.monPaid)} MON · BONUS +${fmtMon(s.monEarned)}`
        } else {
          heroRef.current.textContent = fmtWh(s.whCharged)
          heroLabelRef.current.textContent = 'Wh DELIVERED'
          monRef.current.textContent = `−${fmtMon(s.monPaid)} MON`
        }
      }
      if (kwRef.current) kwRef.current.textContent = `${Math.round(s.kW)} kW`
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(s.kwFrac, 1)})`
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${s.soc})`

      // The bay floor rushes at the delivery rate, and reverses on the Flip:
      // the speed of the ground IS the power reading, read peripherally while
      // both thumbs are busy. Two composited writes, no layout.
      const frac = Math.min(s.kwFrac, 1)
      const dir = s.phase === 'v2g' ? -1 : 1
      bayScroll = (bayScroll + dir * dtMs * 0.001 * (70 + 420 * frac)) % BAY_TILE
      if (bayGridRef.current) {
        bayGridRef.current.style.transform = `translate3d(0, ${bayScroll.toFixed(1)}px, 0)`
      }
      if (bayGlowRef.current) {
        bayGlowRef.current.style.opacity = (0.2 + 0.8 * frac).toFixed(2)
      }

      // the stream is the input rendered as light
      stream.ratePerSec = 1.5 + 10 * Math.min(s.kwFrac, 1)
      stream.speedPerSec = 0.55 + 1.1 * Math.min(s.kwFrac, 1)
      stream.direction = s.phase === 'v2g' ? -1 : 1
      stream.step(dtMs)

      // surge window edges
      if (s.surge !== surgeOn) {
        surgeOn = s.surge
        surgeRef.current?.classList.toggle('surge-on', surgeOn)
      }

      // the Flip (§3.6)
      if (s.phase === 'v2g' && !flipped) {
        flipped = true
        flipSound()
        navigator.vibrate?.(12)
        setFlash(true)
        setTimeout(() => setFlash(false), 300)
        setPhase('v2g')
      }

      // final 3s countdown stamps (a 5s countdown is a third of a 15s round)
      const remaining = Math.ceil((SESSION_MS - s.t) / 1000)
      if (remaining <= 3 && remaining >= 1 && remaining !== lastCountdown) {
        lastCountdown = remaining
        const el = countdownRef.current
        if (el) {
          el.textContent = String(remaining)
          el.classList.remove('stamp')
          void el.offsetWidth
          el.classList.add('stamp')
        }
      }

      if (s.phase === 'done') {
        endedRef.current = true
        enqueueTick(engine.drainTick())
        chime()
        const final = engine.snapshot()
        setTimeout(() => {
          onEndRef.current({
            whCharged: final.whCharged,
            whDischarged: final.whDischarged,
            monPaid: final.monPaid,
            monEarned: final.monEarned,
            score: final.score,
            tapCount: final.tapCount,
            flipped: final.flippedAt !== null,
          })
        }, 650)
      }
    })

    return () => {
      stop()
      clearInterval(tickTimer)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointerup', onUp)
      root.removeEventListener('pointercancel', onUp)
      root.removeEventListener('gesturestart', blockGesture)
      document.removeEventListener('visibilitychange', onVis)
      lock?.release().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={rootRef} className="screen charging no-touch-ui" data-phase={phase}>
      {flash && <div className="flip-flash" aria-hidden />}
      <div ref={surgeRef} className="surge-vignette" aria-hidden>
        <span className="surge-stamp num">GRID SURGE ×2</span>
      </div>

      <div className="tap-layer" aria-hidden>
        {Array.from({ length: RIPPLE_POOL }, (_, i) => (
          <div key={i} className="ripple" />
        ))}
      </div>

      <header className="charging-head">
        <span ref={heroRef} className="num hero-value">
          0
        </span>
        <span ref={heroLabelRef} className="label hero-label">
          Wh DELIVERED
        </span>
        <span ref={monRef} className="num mon-line">
          −0.0000 MON
        </span>
        <span className="phase-chip label" data-role="phase">
          {phase === 'v2g' ? 'BONUS · SELLING BACK TO GRID' : 'PAYING · GRID → CAR'}
        </span>
      </header>

      <div className="charging-stage hairline-top">
        {/* The bay, in CSS 3D behind the car. Composited transforms only —
            nothing here touches the tap path or the rAF budget. */}
        <div className="bay3d" aria-hidden>
          <div className="bay3d-plane">
            <div ref={bayGridRef} className="bay3d-grid" />
          </div>
          <div ref={bayGlowRef} className="bay3d-glow" />
          <div className="bay3d-horizon" />
        </div>

        <svg ref={svgRef} className="charging-svg">
          <path ref={cablePathRef} className="cable" fill="none" stroke="var(--cyan-dim)" strokeWidth={4} strokeLinecap="round" />
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={i} className="stream-pip" r={3.2} fill="var(--cyan-hot)" opacity={0} />
          ))}
          <g className="charging-car">
            <Car spec={car} fill={0} />
          </g>
        </svg>
        <div className="power-row">
          <div className="power-bar">
            <div ref={barRef} className="power-bar-fill" />
            <div
              className="taper-mark"
              style={{ left: `${TAPER_START_SOC * 100}%` }}
              title={`taper from ${TAPER_START_SOC * 100}%`}
            />
          </div>
          <span ref={kwRef} className="num kw-read">
            0 kW
          </span>
        </div>
        <span className="label pmax-note num">MAX {P_MAX_KW} kW · TAPER AT 80%</span>
      </div>

      <p className="tap-hint label">TAP ANYWHERE — UP TO FIVE FINGERS COUNT</p>

      <div ref={countdownRef} className="countdown num" aria-hidden />
    </div>
  )
}
