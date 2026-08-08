// One requestAnimationFrame loop for the entire app (§10 motion rules).
// Subscribers do their DOM writes inside their callback, batched at the end
// of the frame by virtue of there being exactly one loop.

type FrameFn = (nowMs: number, dtMs: number) => void

const subs = new Set<FrameFn>()
let rafId: number | null = null
let last = 0

function frame(now: number) {
  const dt = last ? now - last : 16.7
  last = now
  for (const fn of subs) fn(now, dt)
  rafId = subs.size > 0 ? requestAnimationFrame(frame) : null
}

export function onFrame(fn: FrameFn): () => void {
  subs.add(fn)
  if (rafId === null) {
    last = 0
    rafId = requestAnimationFrame(frame)
  }
  return () => {
    subs.delete(fn)
    if (subs.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }
}
