import { Markdown, type Components, type MarkdownProps } from 'llx-markdown'
import { highlight } from 'llx-markdown/highlight'
import { html } from 'llx-markdown/html'
import 'katex/dist/katex.min.css'

/* The engines, fetched the first time a page holds a formula or a diagram. */
export const loadMath = () => import('llx-markdown/math')
export const loadMermaid = () => import('mermaid')
export { highlight }

type Props = Omit<MarkdownProps, 'math' | 'mermaid' | 'highlight' | 'html'> & {
  math?: boolean
  diagrams?: boolean
  highlighting?: boolean
  components?: Components
}

/** The library, set up the way the site uses it everywhere. */
export function SiteMarkdown({
  math = true,
  diagrams = true,
  highlighting = true,
  ...props
}: Props) {
  return (
    <Markdown
      {...props}
      // The HTML stage itself, not a loader: the prerendered page and the hydrating client must
      // draw the docs' few tags in their first render, or the markup would not match.
      html={html}
      math={math ? loadMath : null}
      mermaid={diagrams ? loadMermaid : null}
      highlight={highlighting ? highlight : null}
    />
  )
}
