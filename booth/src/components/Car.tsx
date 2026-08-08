// Parametric top-down car — booth spec §4.
// One body path, six parameters. Rarity is paint physics, not geometry.

import { useId } from 'react'
import type { CarSpec } from '../game/cars'

// Local coordinate space. The car points up: front at y=0, rear at y=H.
export const CAR_W = 120
export const CAR_H = 220
// Charge port location in car space (rear-left of the hull).
export function carPortPoint(spec: CarSpec): { x: number; y: number } {
  const halfW = (CAR_W / 2 - 14) * spec.hullWidth
  return { x: CAR_W / 2 - halfW - 2, y: CAR_H * 0.78 }
}

interface Props {
  spec: CarSpec
  /** battery fill 0..1 rendered inside the silhouette; omit to hide */
  fill?: number
  /** run the reveal-time rarity flourish */
  flourish?: boolean
  showPort?: boolean
}

export function Car({ spec, fill, flourish = false, showPort = false }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const bodyClip = `carBody${uid}`

  const halfW = (CAR_W / 2 - 14) * spec.hullWidth
  const len = (CAR_H - 24) * spec.hullLength
  const top = (CAR_H - len) / 2
  const bot = top + len
  const cx = CAR_W / 2
  const noseW = halfW * 0.62 // front narrower than rear

  const body = [
    `M ${cx - noseW} ${top + 16}`,
    `C ${cx - noseW} ${top + 4}, ${cx - halfW * 0.3} ${top}, ${cx} ${top}`,
    `C ${cx + halfW * 0.3} ${top}, ${cx + noseW} ${top + 4}, ${cx + noseW} ${top + 16}`,
    `L ${cx + halfW} ${top + len * 0.32}`,
    `L ${cx + halfW} ${bot - 14}`,
    `C ${cx + halfW} ${bot - 3}, ${cx + halfW * 0.5} ${bot}, ${cx} ${bot}`,
    `C ${cx - halfW * 0.5} ${bot}, ${cx - halfW} ${bot - 3}, ${cx - halfW} ${bot - 14}`,
    `L ${cx - noseW} ${top + len * 0.32}`,
    'Z',
  ].join(' ')

  const cabinW = halfW * (1 - spec.cabinInset) * 0.82
  const cabinTop = top + len * 0.3
  const cabinLen = len * 0.42
  const cabin = [
    `M ${cx - cabinW} ${cabinTop + 10}`,
    `C ${cx - cabinW} ${cabinTop + 2}, ${cx - cabinW * 0.4} ${cabinTop}, ${cx} ${cabinTop}`,
    `C ${cx + cabinW * 0.4} ${cabinTop}, ${cx + cabinW} ${cabinTop + 2}, ${cx + cabinW} ${cabinTop + 10}`,
    `L ${cx + cabinW * 0.92} ${cabinTop + cabinLen}`,
    `C ${cx + cabinW * 0.5} ${cabinTop + cabinLen + 6}, ${cx - cabinW * 0.5} ${cabinTop + cabinLen + 6}, ${cx - cabinW * 0.92} ${cabinTop + cabinLen}`,
    'Z',
  ].join(' ')

  const paint = `hsl(${spec.hue} ${spec.sat}% ${spec.light}%)`
  const paintDark = `hsl(${spec.hue} ${spec.sat}% ${Math.max(spec.light - 14, 8)}%)`

  const axleF = top + len * (0.5 - spec.wheelbase / 2)
  const axleR = top + len * (0.5 + spec.wheelbase / 2) - 26
  const wheelX = [cx - halfW - 5, cx + halfW - 5]
  const port = carPortPoint(spec)

  return (
    <svg
      viewBox={`0 0 ${CAR_W} ${CAR_H}`}
      width={CAR_W}
      height={CAR_H}
      className={`car car-${spec.rarity}${flourish ? ' car-flourish' : ''}`}
      aria-hidden
    >
      <defs>
        <clipPath id={bodyClip}>
          <path d={body} />
        </clipPath>
        <linearGradient id={`metal${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0.06" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={`sheen${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`irid${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7df" stopOpacity="0" />
          <stop offset="0.5" stopColor="#adf" stopOpacity="0.22" />
          <stop offset="1" stopColor="#f7d" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* wheels sit under the body */}
      {wheelX.map((x) =>
        [axleF, axleR].map((y) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width={10} height={26} rx={3} fill="#10181D" />
            {spec.wheelStyle === 1 && (
              <rect x={x + 3.5} y={y + 4} width={3} height={18} rx={1.5} fill="#26343C" />
            )}
          </g>
        )),
      )}

      <path d={body} fill={paint} stroke={paintDark} strokeWidth={1.5} />

      {/* metallic layer — Rare and up */}
      {spec.rarity !== 'common' && <path d={body} fill={`url(#metal${uid})`} />}

      {/* bonnet line + stripe */}
      <line x1={cx - noseW * 0.7} y1={top + len * 0.24} x2={cx + noseW * 0.7} y2={top + len * 0.24} stroke={paintDark} strokeWidth={1} />
      {spec.stripe && (
        <rect x={cx - 4} y={top + 2} width={8} height={len - 4} fill="#fff" opacity={0.14} clipPath={`url(#${bodyClip})`} />
      )}

      <path d={cabin} fill="#1C1C1E" stroke="#262629" strokeWidth={1} />

      {/* headlights: switches, not fades (§3.2) */}
      <rect className="headlight" x={cx - noseW * 0.72} y={top + 3} width={14} height={5} rx={2} fill="#DFF6F8" />
      <rect className="headlight" x={cx + noseW * 0.72 - 14} y={top + 3} width={14} height={5} rx={2} fill="#DFF6F8" />
      {/* tail lights */}
      <rect x={cx - halfW * 0.8} y={bot - 6} width={16} height={4} rx={2} fill="#5A1E22" />
      <rect x={cx + halfW * 0.8 - 16} y={bot - 6} width={16} height={4} rx={2} fill="#5A1E22" />

      {/* battery fill rises inside the silhouette (§3.5). Bottom-anchored
          scaleY so the charging loop can drive it transform-only via ref. */}
      {fill !== undefined && (
        <rect
          className="car-fill"
          x={0}
          y={top}
          width={CAR_W}
          height={len}
          clipPath={`url(#${bodyClip})`}
          fill="var(--cyan)"
          opacity={0.3}
          style={{
            transformOrigin: `${cx}px ${bot}px`,
            transform: `scaleY(${Math.min(Math.max(fill, 0), 1)})`,
          }}
        />
      )}

      {/* Epic/Legendary sheen sweeps — transform-only (§4) */}
      {(spec.rarity === 'epic' || spec.rarity === 'legendary') && (
        <g clipPath={`url(#${bodyClip})`}>
          <rect className="sheen sheen-a" x={-60} y={top - 10} width={44} height={len + 20} fill={`url(#sheen${uid})`} />
          {spec.rarity === 'legendary' && (
            <rect className="sheen sheen-b" x={-60} y={top - 10} width={64} height={len + 20} fill={`url(#irid${uid})`} />
          )}
        </g>
      )}

      {/* Legendary spark pop, 8 pooled particles, reveal only */}
      {spec.rarity === 'legendary' && flourish && (
        <g className="sparks">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return (
              <circle
                key={i}
                className="spark"
                cx={cx}
                cy={top + len / 2}
                r={2}
                fill="#EAF8FA"
                style={{ '--dx': `${Math.cos(a) * 54}px`, '--dy': `${Math.sin(a) * 70}px` } as React.CSSProperties}
              />
            )
          })}
        </g>
      )}

      {showPort && (
        <g className="car-port" transform={`translate(${port.x}, ${port.y})`}>
          <circle r={7} fill="none" stroke="var(--cyan-dim)" strokeWidth={2} className="port-ring" />
          <circle r={2.5} fill="var(--cyan-dim)" className="port-dot" />
        </g>
      )}
    </svg>
  )
}
