/**
 * The Markdown parsers `parse.ts` compares, each set up to read GitHub's Markdown as close to in
 * full as its own packages go, with raw HTML passed through as written (nobody pays for a
 * sanitizer). No React and no DOM: text in, a tree or an HTML string out.
 *
 * - llx-markdown's engine, the parser `<Markdown>` runs, to its tree and on to HTML. It is not a
 *   public entry of the package: `<Markdown>` is.
 * - mdast-util-from-markdown with GFM: remark's parser, the one react-markdown and Streamdown run
 *   on every update.
 * - micromark with GFM: the tokenizer under it, straight to HTML.
 * - marked and markdown-it: the two most used Markdown-to-HTML parsers.
 */
import MarkdownIt from 'markdown-it'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItTaskLists from 'markdown-it-task-lists'
import { Marked } from 'marked'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'
import { parse, toHtml } from '../../packages/llx-markdown/src/engine'

export interface Parser {
  name: string
  /** The npm package whose version the results record. */
  pkg: string
  /** What it hands back: a syntax tree, or HTML text. */
  output: 'tree' | 'html'
  /** What of GitHub's Markdown it reads, set up as here. */
  reads: string
  /** Called once per process, before the clock starts: the parse function, configured. */
  make: () => (markdown: string) => unknown
}

const FULL_GFM = 'CommonMark, tables, task lists, strikethrough, bare links, footnotes'

export const PARSERS: Parser[] = [
  {
    name: 'llx-markdown',
    pkg: 'llx-markdown',
    output: 'tree',
    reads: FULL_GFM,
    make: () => (markdown) => parse(markdown),
  },
  {
    name: 'llx-markdown → HTML',
    pkg: 'llx-markdown',
    output: 'html',
    reads: FULL_GFM,
    make: () => (markdown) => toHtml(parse(markdown)),
  },
  {
    name: 'mdast-util-from-markdown',
    pkg: 'mdast-util-from-markdown',
    output: 'tree',
    reads: FULL_GFM,
    make: () => {
      const options = { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }
      return (markdown) => fromMarkdown(markdown, options)
    },
  },
  {
    name: 'micromark',
    pkg: 'micromark',
    output: 'html',
    reads: FULL_GFM,
    make: () => {
      const options = { allowDangerousHtml: true, extensions: [gfm()], htmlExtensions: [gfmHtml()] }
      return (markdown) => micromark(markdown, options)
    },
  },
  {
    name: 'marked',
    pkg: 'marked',
    output: 'html',
    reads: 'CommonMark, tables, task lists, strikethrough, bare links (no footnotes)',
    make: () => {
      const marked = new Marked({ gfm: true, async: false })
      return (markdown) => marked.parse(markdown)
    },
  },
  {
    name: 'markdown-it',
    pkg: 'markdown-it',
    output: 'html',
    reads: `${FULL_GFM} (with markdown-it-footnote and markdown-it-task-lists)`,
    make: () => {
      const md = new MarkdownIt({ html: true, linkify: true })
        .use(markdownItFootnote)
        .use(markdownItTaskLists)
      return (markdown) => md.render(markdown)
    },
  },
]
