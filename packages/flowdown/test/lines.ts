import { seeded } from './random'

/**
 * The lines where one parse reads across blocks: fences, lists, lazy continuations, HTML, formulas,
 * forms. A seeded document is a handful of them in a row.
 */
export const LINES = [
  '',
  '',
  '',
  'Text.',
  'More text here.',
  '# Title',
  '#### Tab',
  '## Next',
  '---',
  '***',
  'Setext',
  '===',
  '- item',
  '- ',
  '* star',
  '1. one',
  '2. two',
  '7) seven',
  '   continued',
  '  two spaces',
  '    four spaces',
  '\tTabbed',
  '-\ttab item',
  '      deep',
  '> quote',
  '> [!STEPS]',
  '> [!TABS]',
  '> [!PROS]',
  '> [!CONS]',
  '> [!STATS]',
  '> [!SOURCES]',
  '> [!DETAILS] Folded',
  '> [!DETAILS]',
  '- [A link](https://example.com/a) — note',
  '```ts title="a.ts"',
  '> [!WARNING] Careful',
  '> - quoted item',
  '```',
  '```js',
  '~~~',
  '````',
  '   ```',
  '    ```',
  'code `inline` here',
  '```a``` inline',
  '$$',
  '$$ x $$',
  'a $$ b',
  '<div>',
  '</div>',
  '<div>text</div>',
  '<pre>',
  '</pre>',
  '<!-- note',
  '-->',
  '<br>',
  '<span>inline</span> text',
  '<details>',
  '</details>',
  '<summary>S</summary>',
  '![alt](a.png)',
  '*caption*',
  '_also_',
  '| a | b |',
  '| - | - |',
  '| 1 | 2 |',
  '**bold** and *em*',
  '[link](https://a.b)',
  '- [ ] task',
  '- **3×** faster',
  '1. **Step**',
  '   *Day 1*',
]

/**
 * The same lines with link reference definitions and what refers to them: a definition is read
 * across blocks, and a paragraph of definitions is one that one parse leaves nothing of.
 */
export const LINKED_LINES = [
  // Raw HTML is left to the lines above: with a blank line after every other line, a tag left
  // open is a case of its own, whatever the document defines.
  ...LINES.filter((line) => !/^<|-->/.test(line)),
  '[ref]: https://example.com/ref',
  '[Other]: <https://example.com/other> "A title"',
  '[//]: # (a comment)',
  '   [ref]: /again',
  '[two',
  'lines]: /two',
  '[bad]: <not a url> trailing',
  '> [quoted]: /quoted',
  '- [listed]: /listed',
  'See [ref], [text][other] and [two lines].',
  '[quoted] and [listed][] with [bad].',
  '![shot][ref]',
  '![other]',
  '| [ref] | [missing] |',
]

/**
 * The lines above, and lines that are markup only in code: a render prop (its `=>` is no tag's
 * end), an element the HTML parser closes by itself, a list item opened and left. A sweep of
 * their own, so the documents the golden digest holds stay the same.
 */
export const CODE_TAG_LINES = [
  ...LINES,
  '<List',
  '  renderItem={(x) => (',
  '/>',
  '<li>one',
  '<ul>',
  '-',
  '1.',
]

/** The seeded document of `seed`: 2 to 14 of `lines`, the same on every machine. */
export function linesDocument(seed: number, lines: readonly string[] = LINES): string {
  const r = seeded(seed)
  const out: string[] = []
  for (let n = r.int(2, 14); n > 0; n -= 1) out.push(lines[r.int(0, lines.length - 1)]!)
  return out.join('\n')
}

/**
 * A seeded document of the lines with definitions, a blank line after about every other one: the
 * blocks are many, so what refers to a definition is seldom in the block that holds it.
 */
export function linkedDocument(seed: number, lines: readonly string[] = LINKED_LINES): string {
  const r = seeded(seed)
  let out = ''
  for (let n = r.int(2, 14); n > 0; n -= 1) {
    out += lines[r.int(0, lines.length - 1)]!
    if (n > 1) out += r.next() < 0.5 ? '\n\n' : '\n'
  }
  return out
}
