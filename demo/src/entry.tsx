/**
 * One scene of the demo: `?scene=hero&theme=dark`. With `&stream`, the reply starts empty and
 * `window.demo.show(text, streaming)` sets it, so the capture script can stream it frame by frame.
 */
import 'katex/dist/katex.min.css'
import 'llx-markdown/styles.css'
import { Markdown } from 'llx-markdown'
import { highlight } from 'llx-markdown/highlight'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { reviewScenes, scenes } from './scenes'

declare global {
  interface Window {
    demo: { show: (text: string, streaming: boolean) => void; reply: string }
  }
}

const params = new URLSearchParams(location.search)
const scene =
  reviewScenes[params.get('review') ?? ''] ?? scenes[params.get('scene') ?? 'hero'] ?? scenes.hero!
document.documentElement.dataset.theme = params.get('theme') === 'dark' ? 'dark' : 'light'
const streamed = params.has('stream')

const math = () => import('llx-markdown/math')
const html = () => import('llx-markdown/html')
const mermaid = () => import('mermaid')

function Scene() {
  const [reply, setReply] = useState({ text: streamed ? '' : scene.reply, streaming: false })
  useEffect(() => {
    window.demo = { show: (text, streaming) => setReply({ text, streaming }), reply: scene.reply }
  }, [])
  return (
    <main className="chat" data-scene>
      <div className="question">{scene.question}</div>
      <div className="reply">
        <Markdown
          streaming={reply.streaming}
          math={math}
          html={html}
          mermaid={mermaid}
          highlight={highlight}
        >
          {reply.text}
        </Markdown>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Scene />)
