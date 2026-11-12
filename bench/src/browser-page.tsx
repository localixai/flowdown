/**
 * The page `browser.ts` opens: one renderer streaming one scenario in a real browser. It is given
 * the reply's growing prefixes a few per animation frame, each drawn at once (`flushSync`), so
 * every renderer draws the same updates in the same number of frames and the browser lays the
 * page out as often for each.
 *
 * `window.run()` resolves with what the page itself can time; the runner reads the browser's own
 * counters around it.
 */
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { prefixes, type Pattern } from '../../packages/flowdown/test/chunks'
import { scaling, scenarios } from '../../packages/flowdown/test/replies'
import { RENDERERS } from './renderers'

export interface PageResult {
  updates: number
  /** Updates drawn before the time budget ran out; equal to `updates` when the run finished. */
  done: number
  frames: number
  /** Time inside the updates themselves, in milliseconds. */
  drawMs: number
  /** The 95th percentile and the longest of one update, in milliseconds. */
  p95Ms: number
  maxMs: number
  /** The longest gap between two animation frames, in milliseconds. */
  worstFrameMs: number
}

const params = new URLSearchParams(location.search)
const renderer = RENDERERS.find((r) => r.name === params.get('renderer'))
const scenario = [...scenarios(), ...scaling()].find((s) => s.name === params.get('scenario'))
if (!renderer || !scenario?.text) throw new Error(`nothing to run for ${location.search}`)

const { Render } = renderer
const steps = prefixes(scenario.text, (params.get('pattern') ?? 'token') as Pattern)
const perFrame = Number(params.get('per') ?? 6)
const budgetMs = Number(params.get('budget') ?? 30_000)
const root = createRoot(document.getElementById('root')!)

const run = () =>
  new Promise<PageResult>((resolve) => {
    const each: number[] = []
    let at = 0
    let frames = 0
    let drawMs = 0
    let worstFrameMs = 0
    let last = performance.now()
    const finish = () => {
      each.sort((a, b) => a - b)
      resolve({
        updates: steps.length,
        done: at,
        frames,
        drawMs,
        p95Ms: each[Math.floor(each.length * 0.95)] ?? 0,
        maxMs: each.at(-1) ?? 0,
        worstFrameMs,
      })
    }
    const frame = () => {
      const now = performance.now()
      worstFrameMs = Math.max(worstFrameMs, now - last)
      last = now
      frames += 1
      for (let n = 0; n < perFrame && at < steps.length; n++, at++) {
        const text = steps[at]!
        const from = performance.now()
        flushSync(() => root.render(<Render text={text} streaming={at < steps.length - 1} />))
        const took = performance.now() - from
        each.push(took)
        drawMs += took
      }
      // One more frame after the last update, so its layout is inside what the runner reads.
      if (at >= steps.length || drawMs > budgetMs) requestAnimationFrame(finish)
      else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })

Object.assign(window, { run, ready: true })
