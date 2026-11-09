import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, type MarkdownProps } from '../src/index'

/** The static markup of a document, as a server or a first paint would produce it. */
export const render = (markdown: string, props: Omit<MarkdownProps, 'children'> = {}) =>
  renderToStaticMarkup(<Markdown {...props}>{markdown}</Markdown>)
