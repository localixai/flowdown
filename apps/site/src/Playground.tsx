import { useEffect, useState } from 'react'
import { SiteMarkdown } from './markdown'
import { PLAYGROUND_SAMPLE } from './playground-sample'

const TICK_MS = 30

/**
 * Write Markdown on the left, see it on the right. "Stream it" replays the text a few characters
 * per tick into `<Markdown streaming>`, the way a model's reply arrives.
 */
export function Playground() {
  const [source, setSource] = useState(PLAYGROUND_SAMPLE)
  const [streaming, setStreaming] = useState(false)
  const [shown, setShown] = useState(0)
  const [speed, setSpeed] = useState(6)
  const [math, setMath] = useState(true)
  const [diagrams, setDiagrams] = useState(true)
  const [highlighting, setHighlighting] = useState(true)
  // A stream is live until it has shown the whole text; then the interval ends with it.
  const live = streaming && shown < source.length

  useEffect(() => {
    if (!live) return
    // Restarted when the slider moves, so a stream already running changes speed.
    const timer = setInterval(() => {
      setShown((at) => Math.min(at + speed, source.length))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [live, speed, source.length])

  const start = () => {
    setShown(0)
    setStreaming(true)
  }
  const stop = () => setStreaming(false)
  const text = live ? source.slice(0, shown) : source

  return (
    <div className="playground">
      <header className="playground-bar">
        <h1>Playground</h1>
        <div className="playground-controls">
          <button type="button" className="primary" onClick={live ? stop : start}>
            {live ? 'Stop' : 'Stream it'}
          </button>
          <label>
            Speed
            <input
              type="range"
              min={1}
              max={40}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
            <output>{speed} chars / tick</output>
          </label>
          <label>
            <input
              type="checkbox"
              checked={math}
              onChange={(event) => setMath(event.target.checked)}
            />
            Math
          </label>
          <label>
            <input
              type="checkbox"
              checked={diagrams}
              onChange={(event) => setDiagrams(event.target.checked)}
            />
            Diagrams
          </label>
          <label>
            <input
              type="checkbox"
              checked={highlighting}
              onChange={(event) => setHighlighting(event.target.checked)}
            />
            Highlighting
          </label>
          <button type="button" onClick={() => setSource(PLAYGROUND_SAMPLE)}>
            Reset
          </button>
        </div>
      </header>
      <div className="playground-panes">
        <textarea
          aria-label="Markdown source"
          spellCheck={false}
          value={source}
          onChange={(event) => {
            stop()
            setSource(event.target.value)
          }}
        />
        <div className="playground-output" aria-live="off">
          <SiteMarkdown
            streaming={live}
            math={math}
            diagrams={diagrams}
            highlighting={highlighting}
          >
            {text}
          </SiteMarkdown>
        </div>
      </div>
    </div>
  )
}
