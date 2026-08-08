// The cable is the one SVG path whose `d` is rewritten per frame (§3.3), and
// the pip stream along it is the player's input rendered as light (§3.5).

export interface Pt {
  x: number
  y: number
}

/** Cubic bezier `d` string. */
export function cableD(from: Pt, c1: Pt, c2: Pt, to: Pt): string {
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${to.x.toFixed(1)} ${to.y.toFixed(1)}`
}

/**
 * Pooled pips travelling along a path (§10: pooled particle nodes, reused).
 * Direction +1 runs from → to (charging); −1 reverses (V2G).
 */
export class PipStream {
  private pips: Array<{ el: SVGCircleElement; p: number; active: boolean }>
  private path: SVGPathElement
  private spawnAcc = 0
  ratePerSec = 0
  speedPerSec = 0.6
  direction: 1 | -1 = 1

  constructor(path: SVGPathElement, circles: SVGCircleElement[]) {
    this.path = path
    this.pips = circles.map((el) => ({ el, p: 0, active: false }))
  }

  /** Fire one pip immediately (the latch's first pip, §3.3). */
  emit() {
    const free = this.pips.find((q) => !q.active)
    if (!free) return
    free.active = true
    free.p = this.direction === 1 ? 0 : 1
  }

  step(dtMs: number) {
    const dt = dtMs / 1000
    this.spawnAcc += this.ratePerSec * dt
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1
      this.emit()
    }
    let len = 0
    try {
      len = this.path.getTotalLength()
    } catch {
      return
    }
    if (len === 0) return
    for (const pip of this.pips) {
      if (!pip.active) {
        pip.el.style.opacity = '0'
        continue
      }
      pip.p += this.speedPerSec * dt * this.direction
      if (pip.p > 1 || pip.p < 0) {
        pip.active = false
        pip.el.style.opacity = '0'
        continue
      }
      const pt = this.path.getPointAtLength(pip.p * len)
      pip.el.style.opacity = '1'
      pip.el.setAttribute('cx', pt.x.toFixed(1))
      pip.el.setAttribute('cy', pt.y.toFixed(1))
    }
  }

  clear() {
    for (const pip of this.pips) {
      pip.active = false
      pip.el.style.opacity = '0'
    }
  }
}
