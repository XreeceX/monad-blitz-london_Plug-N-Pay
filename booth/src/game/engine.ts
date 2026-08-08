// The settlement engine, in memory. Booth spec §5.
// Fairness invariants (§6): tap rate derives from pointerdown timestamps,
// never a per-frame counter, so frame rate cannot affect score.

import {
  SESSION_MS,
  CAPACITY_KWH,
  P_MAX_KW,
  R_REF_TAPS_PER_SEC,
  R_HARD_CAP_PER_SEC,
  EMA_TAU_MS,
  TAPER_START_SOC,
  TAPER_FLOOR,
  SURGE_WINDOWS_MS,
  SURGE_MULTIPLIER,
  PRICE_MON_PER_KWH,
  V2G_MON_PER_KWH,
  DISCHARGE_SCORE_WEIGHT,
} from './constants'

export type Phase = 'charge' | 'v2g' | 'done'

export interface EngineSnapshot {
  /** ms since session start */
  t: number
  phase: Phase
  soc: number
  kW: number
  /** 0..1 fraction of P_MAX, for visuals */
  kwFrac: number
  whCharged: number
  whDischarged: number
  monPaid: number
  monEarned: number
  tapCount: number
  rate: number
  surge: boolean
  score: number
  flippedAt: number | null
}

export interface Engine {
  /** Register one pointerdown. `nowMs` is a performance.now() timestamp. */
  tap(nowMs: number): void
  /** Advance the simulation. Returns the current snapshot. */
  update(nowMs: number): EngineSnapshot
  snapshot(): EngineSnapshot
  /** Drain the per-second tick accumulator for the relay (§8). */
  drainTick(): {
    t: number
    kW: number
    whDelta: number
    taps: number
    phase: 'charge' | 'v2g'
  }
}

export function score(whCharged: number, whDischarged: number): number {
  return Math.round(whCharged + whDischarged * DISCHARGE_SCORE_WEIGHT)
}

export function createEngine(
  startMs: number,
  surgeWindows: Array<[number, number]> = SURGE_WINDOWS_MS,
): Engine {
  let lastMs = startMs
  let phase: Phase = 'charge'
  let soc = 0
  let kW = 0
  let whCharged = 0
  let whDischarged = 0
  let monPaid = 0
  let monEarned = 0
  let tapCount = 0
  // EMA of the instantaneous tap rate (1/interval), per §5. Noise-free for
  // steady tapping, so the concave power curve isn't eroded by estimator
  // jitter — that erosion broke the "faster always scores higher" invariant.
  let ema = 0
  let lastTapAt: number | null = null
  let flippedAt: number | null = null

  // per-second tick accumulator for the game server
  let tickWh = 0
  let tickTaps = 0

  const inSurge = (t: number) =>
    surgeWindows.some(([a, b]) => t >= a && t < b)

  /** Effective tap rate right now. Falls off once taps stop arriving. */
  function currentRate(nowMs: number): number {
    if (lastTapAt === null) return 0
    const sinceMs = Math.max(nowMs - lastTapAt, 1)
    // between taps the best upper bound on the live rate is 1/timeSince
    return Math.min(ema, 1000 / sinceMs, R_HARD_CAP_PER_SEC)
  }

  function snap(t: number): EngineSnapshot {
    return {
      t,
      phase,
      soc,
      kW,
      kwFrac: kW / P_MAX_KW,
      whCharged,
      whDischarged,
      monPaid,
      monEarned,
      tapCount,
      rate: currentRate(lastMs),
      surge: phase !== 'done' && inSurge(t),
      score: score(whCharged, whDischarged),
      flippedAt,
    }
  }

  return {
    tap(nowMs) {
      if (phase === 'done') return
      tapCount += 1
      tickTaps += 1
      if (lastTapAt === null) {
        // the first tap primes the estimator at a modest one-thumb rate
        ema = 3
        lastTapAt = nowMs
        return
      }
      // FR-BOOTH-13: intervals shorter than the hard cap's are counted at the cap
      const intervalMs = Math.max(nowMs - lastTapAt, 1000 / R_HARD_CAP_PER_SEC)
      const inst = 1000 / intervalMs
      const alpha = 1 - Math.exp(-intervalMs / EMA_TAU_MS)
      ema += (inst - ema) * alpha
      lastTapAt = nowMs
    },

    update(nowMs) {
      const t = nowMs - startMs
      let dt = Math.max(0, nowMs - lastMs) / 1000
      // a backgrounded tab can hand us a huge dt; clamp so nothing teleports
      if (dt > 0.25) dt = 0.25
      lastMs = nowMs

      if (phase === 'done') return snap(SESSION_MS)

      const r = currentRate(nowMs)

      const base = P_MAX_KW * (1 - Math.exp(-r / R_REF_TAPS_PER_SEC))
      const taper =
        soc <= TAPER_START_SOC
          ? 1
          : 1 - ((soc - TAPER_START_SOC) / (1 - TAPER_START_SOC)) * (1 - TAPER_FLOOR)
      const surge = inSurge(t) ? SURGE_MULTIPLIER : 1
      const kwTarget = base * (phase === 'v2g' ? 1 : taper) * surge
      kW += (kwTarget - kW) * (1 - Math.exp(-dt / 0.25)) // display smoothing

      const whDelta = (kW * dt) / 3.6
      if (phase === 'charge') {
        soc += whDelta / (CAPACITY_KWH * 1000)
        whCharged += whDelta
        monPaid += (whDelta / 1000) * PRICE_MON_PER_KWH
        tickWh += whDelta
        if (soc >= 1) {
          soc = 1
          phase = 'v2g'
          flippedAt = t
        }
      } else {
        // Discharge is not clamped by pack contents — clamping made every
        // player above ~20 taps/s tie at exactly 5500, the §6 failure mode.
        // The SoC floor is display-only; the spec's §5 table implies the same.
        soc = Math.max(0, soc - whDelta / (CAPACITY_KWH * 1000))
        whDischarged += whDelta
        monEarned += (whDelta / 1000) * V2G_MON_PER_KWH
        tickWh += whDelta
      }

      if (t >= SESSION_MS) {
        phase = 'done'
        kW = 0
      }
      return snap(Math.min(t, SESSION_MS))
    },

    snapshot() {
      return snap(Math.min(lastMs - startMs, SESSION_MS))
    },

    drainTick() {
      const out = {
        t: Math.round(lastMs - startMs),
        kW: Math.round(kW * 10) / 10,
        whDelta: Math.round(tickWh * 100) / 100,
        taps: tickTaps,
        phase: phase === 'v2g' ? ('v2g' as const) : ('charge' as const),
      }
      tickWh = 0
      tickTaps = 0
      return out
    },
  }
}
