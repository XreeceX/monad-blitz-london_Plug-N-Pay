// WebAudio, synthesised, zero assets (§11). The AudioContext unlocks on the
// plug gesture — the first user gesture in the flow.

let ctx: AudioContext | null = null

export function unlockAudio() {
  if (ctx) {
    void ctx.resume()
    return
  }
  try {
    ctx = new AudioContext()
    void ctx.resume()
  } catch {
    ctx = null
  }
}

function env(node: GainNode, t0: number, peak: number, attack: number, decay: number) {
  node.gain.setValueAtTime(0, t0)
  node.gain.linearRampToValueAtTime(peak, t0 + attack)
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay)
}

/** Latch payoff: 60Hz sine 50ms + a noise tick (§3.3). */
export function thunk() {
  if (!ctx) return
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 60
  const g = ctx.createGain()
  env(g, t0, 0.5, 0.005, 0.06)
  osc.connect(g).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + 0.09)

  const len = Math.floor(ctx.sampleRate * 0.02)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const ng = ctx.createGain()
  ng.gain.value = 0.15
  src.connect(ng).connect(ctx.destination)
  src.start(t0)
}

/** The Flip: short rising two-tone. */
export function flipSound() {
  if (!ctx) return
  const t0 = ctx.currentTime
  for (const [freq, at] of [[420, 0], [630, 0.09]] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const g = ctx.createGain()
    env(g, t0 + at, 0.25, 0.01, 0.18)
    osc.connect(g).connect(ctx.destination)
    osc.start(t0 + at)
    osc.stop(t0 + at + 0.25)
  }
}

/** Session end chime (§3.5). */
export function chime() {
  if (!ctx) return
  const t0 = ctx.currentTime
  for (const [freq, at] of [[523.25, 0], [784, 0.12]] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const g = ctx.createGain()
    env(g, t0 + at, 0.2, 0.01, 0.5)
    osc.connect(g).connect(ctx.destination)
    osc.start(t0 + at)
    osc.stop(t0 + at + 0.6)
  }
}
