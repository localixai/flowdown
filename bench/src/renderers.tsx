/**
 * The renderers compared, each as a component that takes a reply and whether it is still
 * streaming. Each one is configured the way its README tells a chat to use it, with no
 * highlighter, math or diagrams, so every one parses the same Markdown and draws the same kind of
 * page. `llx+highlight` adds the one optional stage that runs on every token of a code fence.
 */
import { createRequire } from 'node:module'
import { Markdown } from 'llx-markdown'
import { highlight } from 'llx-markdown/highlight'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Streamdown } from 'streamdown'

export interface Renderer {
  name: string
  version: string
  about: string
  Render: (props: { text: string; streaming: boolean }) => ReactNode
}

const require = createRequire(import.meta.url)
const versionOf = (pkg: string) => (require(`${pkg}/package.json`) as { version: string }).version

const gfm = [remarkGfm]

export const RENDERERS: Renderer[] = [
  {
    name: 'llx',
    version: versionOf('llx-markdown'),
    about: '`<Markdown streaming>`: blocks, healing, the dialect.',
    Render: ({ text, streaming }) => <Markdown streaming={streaming}>{text}</Markdown>,
  },
  {
    name: 'llx+highlight',
    version: versionOf('llx-markdown'),
    about: 'The same, with `llx-markdown/highlight` colouring code.',
    Render: ({ text, streaming }) => (
      <Markdown streaming={streaming} highlight={highlight}>
        {text}
      </Markdown>
    ),
  },
  {
    name: 'streamdown',
    version: versionOf('streamdown'),
    about: '`<Streamdown mode="streaming" isAnimating>`: blocks and `remend` healing.',
    Render: ({ text, streaming }) => (
      <Streamdown mode={streaming ? 'streaming' : 'static'} isAnimating={streaming}>
        {text}
      </Streamdown>
    ),
  },
  {
    name: 'react-markdown',
    version: versionOf('react-markdown'),
    about: '`<ReactMarkdown remarkPlugins={[remarkGfm]}>`: the whole reply parsed on every update.',
    Render: ({ text }) => <ReactMarkdown remarkPlugins={gfm}>{text}</ReactMarkdown>,
  },
]
