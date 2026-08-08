// Calibration check against booth spec §5's table. Run: npx tsx scripts/calibrate.ts
// Simulates a player tapping at a constant rate, 120Hz update, full session.

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

const expected: Array<[number, number, number | null]> = [
  [4, 2109, null],
  [5, 2365, 42.6],
  [7, 3323, 35.6],
  [9, 4052, 30.3],
  [12, 4785, 26.6],
  [15, 5269, 25.5],
  [20, 5732, 24.6],
  [25, 5976, 24.0],
  [40, 6098, 23.8], // above the 30/s cap → engine-cap score
]

console.log('taps/s | score (spec) | flip s (spec)')
let worst = 0
for (const [rate, wantScore, wantFlip] of expected) {
  const { score, flip } = simulate(rate)
  const flipS = flip === null ? null : flip / 1000
  const err = Math.abs(score - wantScore) / wantScore
  worst = Math.max(worst, err)
  console.log(
    `${String(rate).padStart(6)} | ${String(score).padStart(5)} (${wantScore}) | ${
      flipS === null ? 'never' : flipS.toFixed(1)
    } (${wantFlip ?? 'never'})`,
  )
}
console.log(`worst score deviation: ${(worst * 100).toFixed(1)}%`)
