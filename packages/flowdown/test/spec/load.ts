import { readFileSync } from 'node:fs'
import { parse, toHtml } from '../../src/engine'
import { addEntities } from '../../src/engine/entities'
import { ENTITY_TABLE } from '../../src/engine/entity-table'

// The specification names references from all of HTML5; a page fetches these on demand.
addEntities(ENTITY_TABLE)

export interface Example {
  /** The suite the example belongs to. */
  suite: 'CommonMark' | 'GFM' | 'cmark-gfm'
  section: string
  number: number
  markdown: string
  html: string
  /** The GitHub extension the example is about; empty for plain CommonMark. */
  extension: string
}

const tabs = (text: string): string => text.replace(/→/g, '\t')

/**
 * The examples of a specification in the repository's `spec/`, the files the Rust crate's tests
 * read too, each with the extension it is marked with.
 */
const examples = (file: string, suite: Example['suite']): Example[] => {
  const text = readFileSync(new URL(`../../../../spec/${file}`, import.meta.url), 'utf8')
    .replace(/\r\n?/g, '\n')
    .replace(/^<!-- END TESTS -->[\s\S]*/m, '')
  const out: Example[] = []
  let section = ''
  const pattern = /^`{32} example([^\n]*)\n([\s\S]*?)^\.\n([\s\S]*?)^`{32}$|^#{1,6} *(.*)$/gm
  for (const hit of text.matchAll(pattern)) {
    if (hit[4] !== undefined) section = hit[4]
    else
      out.push({
        suite,
        section,
        number: out.length + 1,
        markdown: tabs(hit[2] ?? ''),
        html: tabs(hit[3] ?? ''),
        extension: (hit[1] ?? '').trim(),
      })
  }
  return out
}

/** CommonMark 0.31.2: every example of the specification. */
export const commonmark = (): Example[] => examples('commonmark/spec.txt', 'CommonMark')

/**
 * The examples of GitHub Flavored Markdown's specification that are about an extension. The rest
 * of that file restates an older CommonMark, which the CommonMark suite covers at 0.31.2.
 */
export const gfm = (): Example[] =>
  examples('github/gfm-spec.txt', 'GFM').filter(
    (example) => example.extension !== '' && example.extension !== 'disabled',
  )

/** cmark-gfm's own tests of the extensions: tables, strikethrough, autolinks, task lists, footnotes. */
export const cmarkGfm = (): Example[] => examples('github/gfm-extensions.txt', 'cmark-gfm')

/**
 * cmark-gfm writes a task box as `<input type="checkbox" disabled="" />`; the same element with
 * its attributes in another order is the same HTML.
 */
const normalize = (html: string): string =>
  html.replace(
    /<input type="checkbox" (checked="" )?disabled="" \/>/g,
    (_, checked: string | undefined) => `<input ${checked ?? ''}disabled="" type="checkbox">`,
  )

/** What the engine makes of an example, and whether it is what the specification asks for. */
export const run = (example: Example): { html: string; pass: boolean } => {
  const extended = example.suite !== 'CommonMark'
  const html = toHtml(parse(example.markdown, { gfm: extended }), { tagFilter: extended })
  // One cmark-gfm test only asks that the parser survive its input.
  return { html, pass: html === normalize(example.html) || example.html === '<IGNORE>\n' }
}
