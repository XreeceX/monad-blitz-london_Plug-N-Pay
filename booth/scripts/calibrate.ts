// Calibration check for the 15s round. Run: npx tsx scripts/calibrate.ts
// Verifies the fairness invariants from booth spec §6: score strictly
// increasing with tap rate up to the 30/s cap, no ties in the human range,
// and the Flip reachable late for a typical player, barely for a casual one.

import { createEngine } from '../src/game/engine'
import { SESSION_MS } from '../src/game/constants'

function simulate(tapsPerSec: number) {
  const engine = createEngine(0)
  const dt = 1000 / 120
  let nextTap = tapsPerSec > 0 ? 1000 / tapsPerSec : Infinity
  let flip: number | null = null
  for (let t = 0; t <= SESSION_MS; t += dt) {
    while (t >= nextTap) {
      engine.tap(nextTap)
      nextTap += 1000 / tapsPerSec
    }
    const s = engine.update(t)
    if (flip === null && s.flippedAt !== null) flip = s.flippedAt
  }
  const s = engine.snapshot()
  return { score: s.score, flip }
}

const rates = [3, 4, 5, 7, 9, 12, 15, 20, 25, 30, 40]
console.log('taps/s | score | flip at')
let prev = -1
let monotonic = true
for (const rate of rates) {
  const { score, flip } = simulate(rate)
  console.log(
    `${String(rate).padStart(6)} | ${String(score).padStart(5)} | ${
      flip === null ? 'never' : (flip / 1000).toFixed(1) + 's'
    }`,
  )
  if (rate <= 30 && score <= prev) monotonic = false
  if (rate <= 30) prev = score
}
console.log(monotonic ? 'OK: strictly increasing up to the 30/s cap' : 'FAIL: tie or inversion found')
