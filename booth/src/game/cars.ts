// Parametric car catalogue — booth spec §4.
// One body path, six parameters. Rarity is paint physics, not geometry:
// it affects nothing but looks (FR-BOOTH-6). Every car has identical
// capacity and identical physics; the plate's kWh figure is flavour text.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface CarSpec {
  id: string
  name: string // "KESTREL GT"
  plateKwh: number // flavour text only
  rarity: Rarity
  hullLength: number // 0..1 scale
  hullWidth: number // 0..1 scale
  cabinInset: number // 0..1
  wheelbase: number // 0..1
  wheelStyle: 0 | 1
  hue: number
  sat: number
  light: number
  stripe: boolean
}

const NAMES = [
  'KESTREL', 'VOLTA', 'MERIDIAN', 'HALCYON', 'ONYX', 'ZEPHYR',
  'CALDERA', 'AURELIA', 'VECTOR', 'SABLE', 'LUMEN', 'TALON',
  'ORACLE', 'FathOM', 'BOREAL', 'CIRRUS',
].map((n) => n.toUpperCase())

const SUFFIXES = ['GT', 'RS', 'SE', 'X', 'PRIME', 'ION', 'GTS', 'R']

/** FNV-1a 32-bit */
export function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic: the same deviceId always yields the same car (§3.1). */
export function carFromDeviceId(deviceId: string): CarSpec {
  const rnd = mulberry32(hash32(deviceId))

  const roll = rnd()
  const rarity: Rarity =
    roll < 0.6 ? 'common' : roll < 0.85 ? 'rare' : roll < 0.97 ? 'epic' : 'legendary'

  return {
    id: hash32(deviceId).toString(16).padStart(8, '0'),
    name: `${NAMES[Math.floor(rnd() * NAMES.length)]} ${SUFFIXES[Math.floor(rnd() * SUFFIXES.length)]}`,
    plateKwh: Math.round(58 + rnd() * 46),
    rarity,
    hullLength: 0.82 + rnd() * 0.18,
    hullWidth: 0.8 + rnd() * 0.2,
    cabinInset: 0.16 + rnd() * 0.1,
    wheelbase: 0.56 + rnd() * 0.12,
    wheelStyle: rnd() < 0.5 ? 0 : 1,
    hue: Math.floor(rnd() * 360),
    sat: 28 + Math.floor(rnd() * 44),
    light: 34 + Math.floor(rnd() * 26),
    stripe: rnd() < 0.35,
  }
}

export function driverHandle(deviceId: string): string {
  return `DRIVER-${hash32(deviceId + ':nick').toString(16).slice(0, 3).toUpperCase()}`
}

/** Short claim code shown on the results screen (§7). Not a key, not a secret. */
export function claimCode(deviceId: string): string {
  return hash32(deviceId + ':claim').toString(16).slice(0, 6).toUpperCase()
}
