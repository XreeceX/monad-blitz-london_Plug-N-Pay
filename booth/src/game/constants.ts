// Game model constants — booth spec §5, retuned 2026-08-08 for a 15s round
// (team decision: shorter loop, V2G kept as an end-of-run bonus rather than
// the main act). Battery resized so the Flip still lands late: a typical
// player (7 taps/s) flips near t≈12s, a casual one barely at the end.
// Tuned live at the booth if needed; verify with scripts/calibrate.ts.

export const SESSION_MS = 15_000
export const CAPACITY_KWH = 0.8
export const P_MAX_KW = 350
export const R_REF_TAPS_PER_SEC = 7 // soft-saturation reference, NOT a cap
export const R_HARD_CAP_PER_SEC = 30 // above any human rate (FR-BOOTH-13)
export const MAX_POINTERS = 5 // multi-finger is allowed and expected (FR-BOOTH-14)
export const EMA_TAU_MS = 450
export const TAPER_START_SOC = 0.8
export const TAPER_FLOOR = 0.25 // multiplier at 100% SoC
export const SURGE_WINDOWS_MS: Array<[number, number]> = [
  [4_000, 6_000],
  [10_500, 12_500],
]
export const SURGE_MULTIPLIER = 2.0
export const TICK_REPORT_MS = 1_000 // tap events → game server. NOT a chain call.
export const PRICE_MON_PER_KWH = 0.12 // charging, player pays
export const V2G_MON_PER_KWH = 0.3 // sell-back premium, player earns

export const DISCHARGE_SCORE_WEIGHT = 1.5
