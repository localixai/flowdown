/**
 * One run: a renderer mounted in a DOM, handed every prefix of a reply as a host would, then the
 * finished reply. Each update is timed from `root.render` to the DOM being committed (`flushSync`),
 * which is the main-thread work a token costs: healing, parsing, React and the DOM. Layout and
 * paint are the browser's and are not in it.
 */
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { Renderer } from './renderers'

export interface RunResult {
  updates: number
  /** Updates drawn before the time budget ran out; equal to `updates` when the run finished. */
  drawn: number
  timedOut: boolean
  /** Milliseconds of each update, in order. */
  times: number[]
  mountMs: number
  finishMs: number
  cpuMs: number
  /** Heap growth while the page is mounted, and what is left once it is unmounted. */
  liveBytes: number
  leftBytes: number
  nodes: number
}

const gc = () => {
  Bun.gc(true)
  Bun.gc(true)
}
const heap = () => process.memoryUsage().heapUsed

function Thread({
  renderer,
  history,
  text,
  streaming,
}: {
  renderer: Renderer
  history: readonly string[]
  text: string
  streaming: boolean
}) {
  const { Render } = renderer
  return (
    <main>
      {history.map((reply, index) => (
        <article key={index}>
          <Render text={reply} streaming={false} />
        </article>
      ))}
      <article key="live">
        <Render text={text} streaming={streaming} />
      </article>
    </main>
  )
}

export function measure(
  renderer: Renderer,
  history: readonly string[],
  steps: readonly string[],
  budgetMs: number,
): RunResult {
  const host = document.createElement('div')
  document.body.append(host)
  gc()
  const before = heap()
  const cpu = process.cpuUsage()
  const root = createRoot(host)
  const draw = (text: string, streaming: boolean) => {
    const start = performance.now()
    flushSync(() =>
      root.render(
        <Thread renderer={renderer} history={history} text={text} streaming={streaming} />,
      ),
    )
    return performance.now() - start
  }

  const mountMs = draw('', true)
  const times: number[] = []
  let spent = 0
  for (const text of steps) {
    const took = draw(text, true)
    times.push(took)
    spent += took
    if (spent > budgetMs) break
  }
  const timedOut = times.length < steps.length
  const finishMs = timedOut ? Number.NaN : draw(steps.at(-1) ?? '', false)
  const used = process.cpuUsage(cpu)

  gc()
  const liveBytes = heap() - before
  const nodes = host.querySelectorAll('*').length
  flushSync(() => root.unmount())
  host.remove()
  gc()
  return {
    updates: steps.length,
    drawn: times.length,
    timedOut,
    times,
    mountMs,
    finishMs,
    cpuMs: (used.user + used.system) / 1000,
    liveBytes,
    leftBytes: heap() - before,
    nodes,
  }
}
