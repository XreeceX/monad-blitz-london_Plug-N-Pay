// The station pillar the cable hangs from.

interface Props {
  x: number
  y: number
}

export function ChargePost({ x, y }: Props) {
  return (
    <g transform={`translate(${x}, ${y})`} className="charge-post">
      <rect x={-22} y={-64} width={44} height={64} rx={4} fill="var(--surface)" stroke="var(--line)" />
      <rect x={-14} y={-54} width={28} height={16} rx={2} fill="var(--ink)" stroke="var(--line)" />
      <circle cx={0} cy={-24} r={5} fill="none" stroke="var(--cyan-dim)" strokeWidth={2} />
      <rect x={-22} y={-4} width={44} height={4} fill="var(--line)" />
    </g>
  )
}
