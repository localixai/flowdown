/**
 * The renderers compared, each as a component that takes a reply and whether it is still
 * streaming. Each one is configured the way its README tells a chat to use it, with no
 * highlighter, math or diagrams, so every one parses the same Markdown and draws the same kind of
 * page. `flowdown+highlight` adds the one optional stage that runs on every token of a code fence.
 */
import { createRequire } from 'node:module'
import { Markdown } from '@localix-ai/flowdown'
import { highlight } from '@localix-ai/flowdown/highlight'
import type { ReactNode } from 'react'
import MarkdownToJsx from 'markdown-to-jsx/react'
import MarkedReact from 'marked-react'
import MarkstreamRender from 'markstream-react'
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
    name: 'flowdown',
    version: versionOf('@localix-ai/flowdown'),
    about: '`<Markdown streaming>`: blocks, healing, the dialect.',
    Render: ({ text, streaming }) => <Markdown streaming={streaming}>{text}</Markdown>,
  },
  {
    name: 'flowdown+highlight',
    version: versionOf('@localix-ai/flowdown'),
    about: 'The same, with `@localix-ai/flowdown/highlight` colouring code.',
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
  {
    name: 'markdown-to-jsx',
    version: versionOf('markdown-to-jsx'),
    about:
      '`<Markdown options={{ optimizeForStreaming }}>`: holds back unfinished syntax while streaming.',
    Render: ({ text, streaming }) => (
      <MarkdownToJsx options={{ optimizeForStreaming: streaming }}>{text}</MarkdownToJsx>
    ),
  },
  {
    name: 'markstream',
    version: versionOf('markstream-react'),
    about: '`<MarkdownRender content final fade={false}>` (markstream-react): a streaming parser.',
    Render: ({ text, streaming }) => (
      <MarkstreamRender content={text} final={!streaming} fade={false} />
    ),
  },
  {
    name: 'marked-react',
    version: versionOf('marked-react'),
    about: '`<Markdown value gfm>`: marked, rendered to React elements.',
    Render: ({ text }) => <MarkedReact value={text} gfm />,
  },
]
