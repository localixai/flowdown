/**
 * What the sniffers and the escaper read is held to what the parser reads, on seeded documents
 * built from the lines where structure is hardest to tell by lines alone: fences in list items and
 * quotes, lazy continuations, HTML blocks, formulas. A wrong no from a sniffer drops what the page
 * should draw (`<details>`, a formula); a wrong yes only loads a stage it did not need. The
 * escaper must never touch code. `FUZZ=60000 bun test prose` for a longer sweep.
 */
import { expect, test } from 'bun:test'
import { linesDocument, linkedDocument } from '../../test/lines'
import { parse } from '../engine'
import type { Node } from '../engine/types'
import { splitBlocks } from './blocks'
import { escapeLiteralDollars } from './dollars'
import { mathSyntax } from './math-syntax'
import { markdownProseWithoutCode } from './prose'
import { hasHtmlSyntax } from './syntax'

const count = Number(process.env.FUZZ ?? 2000)
/** A long sweep (`FUZZ=…`) takes longer than a test is given by default. */
const timeout = process.env.FUZZ ? 600_000 : undefined
const documents = [
  ...Array.from({ length: count }, (_, seed) => linesDocument(seed + 1)),
  ...Array.from({ length: Math.ceil(count / 10) }, (_, seed) => linkedDocument(seed + 1)),
]
const blocks = documents.flatMap((text) => splitBlocks(text).map((block) => block.source))

/** Whether the tree holds an HTML tag that opens an element: what the HTML stage would draw. */
const opensTag = (node: Node): boolean =>
  ((node.type === 'html' || node.type === 'inlineHtml') &&
    /<[a-zA-Z][\w-]*[\s/>]/.test(node.value ?? '')) ||
  (node.children ?? []).some(opensTag)

/** The code of a tree, block and inline, in order. */
const codeOf = (node: Node, out: string[] = []): string[] => {
  if (node.type === 'code' || node.type === 'inlineCode') out.push(node.value ?? '')
  for (const child of node.children ?? []) codeOf(child, out)
  return out
}

test(
  'a block whose tree holds HTML is said to have it, on a page with math or without',
  () => {
    const missed = blocks.filter(
      (source) =>
        (opensTag(parse(source)) || opensTag(parse(source, { extensions: [mathSyntax] }))) &&
        !hasHtmlSyntax(source),
    )
    expect(missed).toEqual([])
  },
  timeout,
)

test(
  'the escaper of literal dollars leaves code as it was',
  () => {
    const read = (source: string) => codeOf(parse(source, { extensions: [mathSyntax] }))
    const touched = blocks.filter(
      (source) =>
        source.includes('$') &&
        read(escapeLiteralDollars(source)).join('\0') !== read(source).join('\0'),
    )
    expect(touched).toEqual([])
  },
  timeout,
)

test(
  'the mask is the text, its code blanked, with every position and line break kept',
  () => {
    for (const source of blocks) {
      const mask = markdownProseWithoutCode(source)
      expect(mask.length).toBe(source.length)
      for (let at = 0; at < source.length; at++)
        if (mask[at] !== source[at]) expect([mask[at], source[at] === '\n']).toEqual([' ', false])
    }
  },
  timeout,
)

test('a fence in a list item does not make the text after it code', () => {
  // The scan of lines this replaced took the line that closes this fence for one that opens
  // another, and the `<details>` after it for code.
  const text = '- [ ] task\n    ```\n   continued\n   ```\n*caption*\n\n# Title\n<details>'
  expect(hasHtmlSyntax(text)).toBe(true)
  // Nor do two backtick runs in two blocks make a code span of the lines between them.
  expect(hasHtmlSyntax('A paragraph\n    ```\n\n<br>\n    ```')).toBe(true)
  // A fence inside a formula is the formula's text: its `$$` still closes it.
  expect(markdownProseWithoutCode('$$\n```\nx\n$$\n')).toBe('$$\n```\nx\n$$\n')
})

test('the text is read for a tag before the mask is made, and says no more than the mask', () => {
  // The mask blanks a code span to spaces, so `<div` before one reads as a tag only in the mask:
  // the look at the text first must not turn that answer.
  expect(hasHtmlSyntax('<div`x`')).toBe(true)
  expect(hasHtmlSyntax('a < b and 2<3, `<br>`')).toBe(false)
})
