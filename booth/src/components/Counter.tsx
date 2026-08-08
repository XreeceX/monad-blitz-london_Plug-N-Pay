// Static tabular-nums readouts (the charging screen writes its live numbers
// straight to the DOM inside the single rAF loop instead).

export function fmtWh(wh: number): string {
  return Math.round(wh)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009')
}

export function fmtMon(mon: number): string {
  return mon.toFixed(4)
}

interface Props {
  value: string
  label: string
  unit?: string
  hero?: boolean
}

export function Counter({ value, label, unit, hero = false }: Props) {
  return (
    <div className={hero ? 'counter counter-hero' : 'counter'}>
      <span className="num counter-value">
        {value}
        {unit && <span className="counter-unit"> {unit}</span>}
      </span>
      <span className="label">{label}</span>
    </div>
  )
}
