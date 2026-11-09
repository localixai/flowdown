/**
 * When the work an update queued is done, as a page's event loop would have done it before the
 * next token. React's scheduler runs passive effects, and the renders they cause, in tasks it
 * posts with `setImmediate`; this counts those tasks, so a stream can wait for them to run out.
 *
 * Without the wait every update ran in one synchronous loop: the effects piled up as thousands of
 * queued tasks (heap that looked kept), a renderer that sets state from an effect hit React's
 * nested-update limit, and code loaded on demand (Streamdown's code block) never arrived, so its
 * fallback was measured instead. Install before React DOM is imported: the scheduler reads
 * `setImmediate` once, when it loads.
 */
let pending = 0
let waiters: Array<() => void> = []

export function installIdleTracking() {
  const original = globalThis.setImmediate
  const tracked = ((callback: (...args: unknown[]) => void, ...args: unknown[]) => {
    pending += 1
    return original(() => {
      try {
        callback(...args)
      } finally {
        pending -= 1
        if (pending === 0) {
          const ready = waiters
          waiters = []
          for (const done of ready) done()
        }
      }
    })
  }) as typeof setImmediate
  globalThis.setImmediate = Object.assign(tracked, original)
}

/** Resolves once the scheduler has no task queued, after at least one turn of the event loop. */
export async function idle(): Promise<void> {
  await new Promise<void>((done) => setImmediate(done))
  while (pending > 0) await new Promise<void>((done) => waiters.push(done))
}
