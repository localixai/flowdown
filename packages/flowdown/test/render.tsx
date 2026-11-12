import { renderToStaticMarkup } from 'react-dom/server'
import { html } from '../src/html'
import { Markdown, type MarkdownProps } from '../src/index'

/**
 * The static markup of a document, as a server renders it: with the HTML stage given directly, so
 * raw HTML is in the first render (a lazy stage would only arrive after an effect).
 */
export const render = (markdown: string, props: Omit<MarkdownProps, 'children'> = {}) =>
  renderToStaticMarkup(
    <Markdown html={html} {...props}>
      {markdown}
    </Markdown>,
  )
