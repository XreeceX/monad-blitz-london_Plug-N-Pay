// Parametric top-down car — booth spec §4.
// One body path, six parameters. Rarity is paint physics, not geometry.
//
// Shading is gradients only, never an SVG <filter>: on the charging screen this
// SVG repaints every frame as the battery fill scales, and a Gaussian blur in
// that path would cost far more than the look is worth.

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

  // Greenhouse, split into three panels so the roof reads as sheet metal
  // between two pieces of glass rather than one dark slab.
  const cabinW = halfW * (1 - spec.cabinInset) * 0.82
  const cabinTop = top + len * 0.3
  const cabinLen = len * 0.42
  const roofTop = cabinTop + cabinLen * 0.34
  const roofBot = cabinTop + cabinLen * 0.72

  const windscreen = [
    `M ${cx - cabinW * 0.78} ${roofTop}`,
    `C ${cx - cabinW * 0.66} ${cabinTop + 2}, ${cx + cabinW * 0.66} ${cabinTop + 2}, ${cx + cabinW * 0.78} ${roofTop}`,
    'Z',
  ].join(' ')

  const rearGlass = [
    `M ${cx - cabinW * 0.82} ${roofBot}`,
    `C ${cx - cabinW * 0.7} ${cabinTop + cabinLen + 4}, ${cx + cabinW * 0.7} ${cabinTop + cabinLen + 4}, ${cx + cabinW * 0.82} ${roofBot}`,
    'Z',
  ].join(' ')

  const paint = `hsl(${spec.hue} ${spec.sat}% ${spec.light}%)`
  const paintLit = `hsl(${spec.hue} ${Math.min(spec.sat + 6, 100)}% ${Math.min(spec.light + 16, 92)}%)`
  const paintDark = `hsl(${spec.hue} ${spec.sat}% ${Math.max(spec.light - 14, 8)}%)`
  const paintDeep = `hsl(${spec.hue} ${spec.sat}% ${Math.max(spec.light - 24, 5)}%)`

  const axleF = top + len * (0.5 - spec.wheelbase / 2)
  const axleR = top + len * (0.5 + spec.wheelbase / 2) - 26
  const wheelX = [cx - halfW - 4, cx + halfW - 6]
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

        {/* Form: lit along the near shoulder, falling away to the far one. */}
        <linearGradient id={`paint${uid}`} x1="0" y1="0.1" x2="1" y2="0.9">
          <stop offset="0" stopColor={paintLit} />
          <stop offset="0.34" stopColor={paint} />
          <stop offset="0.78" stopColor={paintDark} />
          <stop offset="1" stopColor={paintDeep} />
        </linearGradient>

        {/* A single soft highlight running the length of the roofline. */}
        <linearGradient id={`gloss${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={`glass${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#8FB6D8" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#1B2C3A" stopOpacity="0.95" />
          <stop offset="1" stopColor="#0B141C" />
        </linearGradient>

        <linearGradient id={`metal${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0.08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.12" />
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

        <radialGradient id={`beam${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#DFF6F8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#DFF6F8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`tail${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FF453A" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FF453A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Contact shadow — the difference between a car parked on the ground
          and a sticker floating above it. */}
      <ellipse cx={cx} cy={bot - len * 0.46} rx={halfW * 1.16} ry={len * 0.5} fill="#000" opacity={0.34} />

      {/* Tyres sit under the body and are overlapped by it. */}
      {wheelX.map((x) =>
        [axleF, axleR].map((y) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width={11} height={27} rx={4.5} fill="#0B1116" />
            <rect x={x + 1} y={y + 2} width={9} height={23} rx={3.5} fill="#171F26" />
            {spec.wheelStyle === 1 && (
              <rect x={x + 3.5} y={y + 6} width={4} height={15} rx={2} fill="#33434E" />
            )}
          </g>
        )),
      )}

      <path d={body} fill={`url(#paint${uid})`} />

      {/* metallic layer — Rare and up */}
      {spec.rarity !== 'common' && <path d={body} fill={`url(#metal${uid})`} />}

      {/* Shoulder highlight: a lit rim along the near edge of the bodywork. */}
      <g clipPath={`url(#${bodyClip})`}>
        <rect x={cx - halfW} y={top} width={halfW * 0.9} height={len} fill={`url(#gloss${uid})`} />
        <path d={body} fill="none" stroke={paintLit} strokeWidth={1.2} opacity={0.5} />
      </g>

      {/* Panel gaps: bonnet shut line, boot shut line, door crease. */}
      <g clipPath={`url(#${bodyClip})`} stroke={paintDeep} strokeWidth={0.9} opacity={0.7}>
        <line x1={cx - noseW * 0.82} y1={top + len * 0.24} x2={cx + noseW * 0.82} y2={top + len * 0.24} />
        <line x1={cx - halfW * 0.86} y1={bot - len * 0.14} x2={cx + halfW * 0.86} y2={bot - len * 0.14} />
        <line x1={cx - halfW} y1={cabinTop + cabinLen * 0.5} x2={cx - cabinW} y2={cabinTop + cabinLen * 0.5} />
        <line x1={cx + halfW} y1={cabinTop + cabinLen * 0.5} x2={cx + cabinW} y2={cabinTop + cabinLen * 0.5} />
      </g>

      {spec.stripe && (
        <rect x={cx - 5} y={top + 2} width={10} height={len - 4} fill="#fff" opacity={0.16} clipPath={`url(#${bodyClip})`} />
      )}

      {/* Glass, roof, glass. */}
      <path d={windscreen} fill={`url(#glass${uid})`} />
      <rect
        x={cx - cabinW * 0.84}
        y={roofTop}
        width={cabinW * 1.68}
        height={roofBot - roofTop}
        rx={2}
        fill={paintDark}
      />
      <rect
        x={cx - cabinW * 0.84}
        y={roofTop}
        width={cabinW * 1.68}
        height={(roofBot - roofTop) * 0.5}
        rx={2}
        fill="#fff"
        opacity={0.07}
      />
      <path d={rearGlass} fill={`url(#glass${uid})`} />

      {/* Mirrors. */}
      <rect x={cx - halfW - 4} y={cabinTop + 2} width={5} height={9} rx={2} fill={paintDark} />
      <rect x={cx + halfW - 1} y={cabinTop + 2} width={5} height={9} rx={2} fill={paintDark} />

      {/* headlights: switches, not fades (§3.2) */}
      <g className="headlight">
        <ellipse cx={cx - noseW * 0.72 + 7} cy={top + 5} rx={19} ry={13} fill={`url(#beam${uid})`} />
        <rect x={cx - noseW * 0.72} y={top + 3} width={14} height={5} rx={2.5} fill="#DFF6F8" />
      </g>
      {/* headlight-b, not :last-of-type — these are <g> now, and other groups
          follow them, so the reveal stagger needs an explicit hook. */}
      <g className="headlight headlight-b">
        <ellipse cx={cx + noseW * 0.72 - 7} cy={top + 5} rx={19} ry={13} fill={`url(#beam${uid})`} />
        <rect x={cx + noseW * 0.72 - 14} y={top + 3} width={14} height={5} rx={2.5} fill="#DFF6F8" />
      </g>

      {/* tail lights */}
      <ellipse cx={cx} cy={bot - 4} rx={halfW * 1.05} ry={9} fill={`url(#tail${uid})`} />
      <rect x={cx - halfW * 0.8} y={bot - 6} width={16} height={4} rx={2} fill="#C4303A" />
      <rect x={cx + halfW * 0.8 - 16} y={bot - 6} width={16} height={4} rx={2} fill="#C4303A" />

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
          <circle r={9} fill="var(--ink)" opacity={0.55} />
          <circle r={7} fill="none" stroke="var(--cyan-dim)" strokeWidth={2} className="port-ring" />
          <circle r={2.5} fill="var(--cyan-dim)" className="port-dot" />
        </g>
      )}
    </svg>
  )
}
