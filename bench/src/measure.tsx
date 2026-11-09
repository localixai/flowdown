/**
 * One run: a renderer mounted in a DOM, handed every prefix of a reply as a host would, then the
 * finished reply. Each update is timed from `root.render` until React's scheduler is idle: the
 * commit (`flushSync`), then the effects it queued (see idle.ts). That is the main-thread work a
 * token costs: healing, parsing, React and the DOM. Layout and paint are the browser's and are not
 * in it.
 */
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { idle } from './idle'
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

/**
 * Lets React's scheduler run the tasks the stream queued. Every update with an effect queues one
 * (a flush of passive effects), and this loop never yields between updates as a page does between
 * tokens, so they pile up: thousands of task objects that read as heap kept by any renderer that
 * has an effect, and as none by react-markdown, which has none. A page's event loop drains them.
 */
async function drain() {
  for (let round = 0; round < 5; round++) await new Promise((done) => setTimeout(done, 10))
}

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

export async function measure(
  renderer: Renderer,
  history: readonly string[],
  steps: readonly string[],
  budgetMs: number,
): Promise<RunResult> {
  const host = document.createElement('div')
  document.body.append(host)
  await drain()
  gc()
  const before = heap()
  const cpu = process.cpuUsage()
  const root = createRoot(host)
  // An update costs its render and commit, and the effects (and renders) it queued: timed until
  // the scheduler is idle, as the page would be before the next token.
  const draw = async (text: string, streaming: boolean) => {
    const start = performance.now()
    flushSync(() =>
      root.render(
        <Thread renderer={renderer} history={history} text={text} streaming={streaming} />,
      ),
    )
    await idle()
    return performance.now() - start
  }

  const mountMs = await draw('', true)
  const times: number[] = []
  let spent = 0
  for (const text of steps) {
    const took = await draw(text, true)
    times.push(took)
    spent += took
    if (spent > budgetMs) break
  }
  const timedOut = times.length < steps.length
  const finishMs = timedOut ? Number.NaN : await draw(steps.at(-1) ?? '', false)
  const used = process.cpuUsage(cpu)

  await drain()
  gc()
  const liveBytes = heap() - before
  const nodes = host.querySelectorAll('*').length
  flushSync(() => root.unmount())
  host.remove()
  await idle()
  await drain()
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
