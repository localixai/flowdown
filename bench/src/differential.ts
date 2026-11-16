/**
 * `bun src/differential.ts [--count=50000] [--seed=1] [--show=3] [--no-write]`
 *
 * flowdown's engine against an independent parser on random text: micromark with GFM, the
 * reference implementation of CommonMark and of GitHub's extensions in JavaScript. The spec
 * suites hold each rule alone; seeded documents mix them, and the mix is where two parsers part:
 * fences in lists in quotes, lazy and indented continuations, delimiters next to links, tables
 * that a paragraph or a list item interrupts, HTML blocks, tabs, entities and escapes.
 *
 * Each document is drawn by both, the two HTML strings normalized, and a document that differs
 * is named: by a rewrite of one output into the other, by the construct whose defusing makes the
 * two alike (an ablation), or by a signature, the open element and the first token where the
 * two part. A few documents of each class are minimized, lines then words then characters,
 * while they stay in it. `KNOWN` gathers classes into families of one cause, each with the side
 * that follows the specification; the script exits non-zero on a class no family takes, or on a
 * crash. Writes results/differential.md.
 */
import { writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import MarkdownIt from 'markdown-it'
import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'
import { parse, toHtml } from '../../packages/flowdown/src/engine'
import { addEntities } from '../../packages/flowdown/src/engine/entities'
import { ENTITY_TABLE } from '../../packages/flowdown/src/engine/entity-table'
import { seeded, type Random } from '../../packages/flowdown/test/random'

const flag = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const count = Number(flag('count') ?? 50_000)
const seed = Number(flag('seed') ?? 1)
const show = Number(flag('show') ?? 3)

// micromark knows every reference HTML5 names; the engine fetches the rare ones on demand.
addEntities(ENTITY_TABLE)

/**
 * Both with raw HTML passed through and every link kept as written: micromark would empty a
 * `javascript:` link, the engine's HTML writer leaves that to the page's `urlTransform`. GFM's tag
 * filter is on in both, as `gfmHtml` applies it. No footnotes are generated: micromark writes
 * GitHub's footnote markup (`user-content-` ids, a heading) and the engine cmark-gfm's, so every
 * footnote would differ in markup alone.
 */
const micromarkOptions = {
  allowDangerousHtml: true,
  allowDangerousProtocol: true,
  extensions: [gfm()],
  htmlExtensions: [gfmHtml()],
}
const flowdown = (markdown: string) => toHtml(parse(markdown), { tagFilter: true })
const reference = (markdown: string) => micromark(markdown, micromarkOptions)

/**
 * markdown-it, a third reading where the two part: CommonMark with tables and strikethrough, but
 * no task lists and no bare links as set up here, so it settles core questions only.
 */
const third = new MarkdownIt({ html: true })

/**
 * The divergences judged so far, each a family of classes: an ablation's or a rewrite's name, or
 * a pattern over signatures. `follows` is the side CommonMark 0.31.2 (spec/commonmark) or GFM
 * (spec/github) asks for; `mixed` families hold more than one cause, named in `why`. A class no
 * family takes is new, and the script fails on it.
 */
interface Known {
  family: string
  match: string | RegExp
  follows: 'flowdown' | 'micromark' | 'mixed' | 'unsettled'
  why: string
}
const KNOWN: Known[] = [
  {
    family: 'bare link',
    match: 'bare link',
    follows: 'flowdown',
    why:
      'GFM bare links (`www.`, `http://`, `a@b.c`). cmark-gfm finds them in text nodes after ' +
      'emphasis and links are read, so `http://a*x*` is a link and then `<em>x</em>`; the ' +
      "engine does the same (spec/github/bare-links.txt is its record of cmark-gfm's ends). " +
      'micromark reads them as it tokenizes, before emphasis, and leaves none after an open `[` ' +
      'or a raw tag. `a@b.1` is an email by the letter of the GFM spec (a period, no `-` or `_` ' +
      'last); micromark refuses a digit-only last label.',
  },
  {
    family: 'indented code split in two',
    match: 'indented code split in two',
    follows: 'flowdown',
    why:
      'After a container closes (an empty quote, an empty item), micromark ends an indented ' +
      'code block at every line and starts another (`>\\n    a\\n    b` gives two blocks), or ' +
      'at a blank line inside it. CommonMark 4.4 makes one block of consecutive indented chunks; ' +
      'markdown-it agrees with flowdown.',
  },
  {
    family: 'line endings only',
    match: 'line endings only',
    follows: 'flowdown',
    why:
      'The outputs differ in line endings and the indentation after them. micromark drops the ' +
      'line endings of an HTML block after a link reference definition (`[r]: /u\\n<pre>\\n  x' +
      '\\n</pre>` gives `<pre>  x</pre>`) and inside some containers, and keeps the indentation ' +
      'of a lazy line; markdown-it agrees with flowdown. Nothing a browser draws differently ' +
      'outside `<pre>`.',
  },
  {
    family: 'tab after a task marker',
    match: 'tab after a task marker',
    follows: 'flowdown',
    why:
      'cmark-gfm takes the whitespace after `[ ]` with the marker and writes the checkbox ' +
      'followed by one space, as the engine does (`<input …> a`); micromark keeps the tab. GFM ' +
      'spec examples only use a space, so this is cmark-gfm behaviour, not spec text.',
  },
  {
    family: 'tab before a line ending',
    match: 'tab before a line ending',
    follows: 'flowdown',
    why:
      'A tab before a soft line break. CommonMark 6.13 says "Spaces at the end of the line … are ' +
      'removed", naming spaces only; commonmark.js and markdown-it keep the tab, as flowdown ' +
      'does. cmark and micromark strip any whitespace. Not a bug on either side; it only shows ' +
      'as whitespace in the HTML.',
  },
  {
    family: 'task marker in a loose item',
    match: 'task marker',
    follows: 'flowdown',
    why:
      "In a loose item cmark-gfm's task-list renderer writes the checkbox right after `<li>`, " +
      'before the `<p>`, as the engine does; micromark puts it inside the paragraph. The GFM ' +
      'spec has no loose task-list example, so this is cmark-gfm behaviour (from its ' +
      'tasklist.c renderer, not run here).',
  },
  {
    family: 'task marker with nothing after it',
    match: 'task marker with nothing after it',
    follows: 'unsettled',
    why:
      '`- [ ]` with nothing after it. flowdown draws an empty checkbox; micromark and ' +
      'markdown-it draw the text `[ ]`. GFM 5.3 asks for "at least one whitespace character" after ' +
      "the marker before other content and says nothing of no content; cmark-gfm's scanner " +
      "counts the line's newline as that whitespace (not checked here). " +
      'Suspect: `reTaskMarker` in engine/blocks.ts, whose lookahead takes `\\n`.',
  },
  {
    family: 'empty list item after another block',
    match: /^(empty list item|.*: <(ol|ul)> \| (<p>|text|<h\d>))$/,
    follows: 'flowdown',
    why:
      'An empty list item (`0.`, `-`) or an ordered one not starting at 1, right after an ' +
      'indented code block, or as the first line of a new quote or item. CommonMark 5.2 forbids ' +
      'only that such an item interrupt a paragraph; none is open here. micromark keeps its ' +
      '"interrupting" state across the closed block and reads text. markdown-it agrees with ' +
      'flowdown.',
  },
  {
    family: 'table without a pipe',
    match: /^(table without a pipe|.+: (<p>|text) \| <table>)$/,
    follows: 'unsettled',
    why:
      'A one-column table with no pipe: `a\\n:-`. micromark makes a table; flowdown and ' +
      'markdown-it keep a paragraph (the engine asks for a `|` in `parseDelimiterRow`, ' +
      "engine/blocks.ts). GFM 4.10's text and examples always have a pipe, but its delimiter " +
      'grammar does not require one, and micromark follows github.com here as far as its ' +
      'author tested. Not settled without cmark-gfm.',
  },
  {
    family: 'table where a list item or paragraph comes first',
    match: /^(table|.*: <table> \| (<p>|text))$/,
    follows: 'micromark',
    why:
      'flowdown bug. (1) `a | b\\n- | -`: the second line is a list item (`- ` then text), and ' +
      "cmark-gfm tries an extension's block (the table) only after every core block start, so " +
      'the list item wins; the engine tries the table delimiter row first, in `startBlock` ' +
      '(engine/blocks.ts, the `container.type === "paragraph"` branch before the list-marker ' +
      'branch). (2) `|\\n-|`: a header of a lone pipe has no cell, so it cannot match one ' +
      'delimiter cell; `splitRow` counts one empty cell for it (the `line === ""` case). ' +
      'micromark and markdown-it agree.',
  },
  {
    family: 'blank lines in a list item (tight or loose)',
    match: /^(blockquote|li: .+ \| <p>|li: <p> \| .+)$/,
    follows: 'mixed',
    why:
      'Two causes. (1) flowdown bug: an item whose indented code block is followed by a blank ' +
      'line and more content (`-     c\\n\\n  x`) is loose, but flowdown draws it tight. ' +
      "Suspect: `finalize`'s `code` case in engine/blocks.ts strips the trailing blank lines " +
      'from the text but leaves `endLine` on the blank line, so `gapAfter` sees no gap. ' +
      'micromark and markdown-it agree. (2) micromark bug: blank `>` lines after a list inside ' +
      'a quote make micromark draw it loose (`>- a\\n>\\n>`); a blank line ending the last item ' +
      'does not loosen a list (CommonMark 5.3), and markdown-it agrees with flowdown. The ' +
      '`blockquote` ablation, which defuses every `>`, also takes some micromark code splits.',
  },
  {
    family: 'link reference definition in a list item',
    match: 'link reference definition',
    follows: 'mixed',
    why:
      'Mostly a flowdown bug: `- a\\n\\n  [r]: /u` is loose, as the definition is a block with a ' +
      'blank line before it (CommonMark 5.3, and example 317 counts it so); micromark and ' +
      "markdown-it draw `<p>a</p>`. The engine's `finalize` removes the emptied paragraph before " +
      'the list is judged, so `gapAfter` never sees it (engine/blocks.ts, `paragraph` and `list` ' +
      'cases). Also one micromark bug: after a definition, `*     c\\n      m` joins two code ' +
      'lines as `cm`.',
  },
  {
    family: 'code at the end of a container',
    match: /^(fenced code|(code|pre): .+)$/,
    follows: 'mixed',
    why:
      'Mostly micromark. Most `code: text | text` documents are its indented-code split where a ' +
      'blank or whitespace-only line sits at the split, which the rewrite does not undo. An ' +
      'unclosed fence that ends with its container gets an extra blank line ' +
      '(`>```\\n>c\\n*`), and an indented block keeps a trailing whitespace-only line (`    *\\n\\t `), ' +
      'which CommonMark 4.4 leaves out; markdown-it agrees with flowdown. Unsettled: an unclosed ' +
      'fence in an item ended by a line of spaces (`1. ```\\n    `): flowdown writes `\\n`, ' +
      'micromark ` \\n`, markdown-it nothing. The fenced-code ablation also takes the code-span ' +
      'case below when a fence opener is read as a code span.',
  },
  {
    family: 'code span across an indented line',
    match: 'code span',
    follows: 'unsettled',
    why:
      'A code span whose second line is indented: `` `\\n ` ``. flowdown drops the indentation ' +
      '(`<code> </code>`); micromark, markdown-it and cmark keep it (`<code>  </code>`). CommonMark ' +
      "4.8 says a paragraph's raw content is its lines with initial spaces or tabs removed, " +
      "which is flowdown's reading, and commonmark.js advances past it the same way, but the " +
      'other reference implementations do not. The engine strips it in `incorporateLine` ' +
      '(`advanceNextNonspace` when no block starts), engine/blocks.ts.',
  },
  {
    family: 'HTML',
    match: /^(HTML|.+: <\/?[a-z-]+> \| .+)$/,
    follows: 'flowdown',
    why:
      'micromark bugs: a lazy line after a raw-HTML line ends the paragraph (`- a\\n<x>\\n`b` ' +
      'ends the item after `<x>`); a type-7 tag line after a paragraph line with `|` ends the ' +
      "paragraph (micromark-extension-gfm-table's interrupt state); `<script` at the end of the " +
      'input escapes the tag filter. markdown-it agrees with flowdown on the CommonMark ones.',
  },
  {
    family: 'emphasis and the rule of three',
    match: /^.+: text \| <(em|strong)>$/,
    follows: 'flowdown',
    why:
      '`**]* f*b`. After `<em>]</em>` takes one `*` of the opening `**`, micromark matches the ' +
      'one left with the `*` of `f*b`. CommonMark 6.2 rule 9 forbids it: the closer can open and ' +
      'close, and the lengths of the delimiter runs (2 and 1, as written) add up to 3. ' +
      'micromark checks the lengths left over instead.',
  },
  {
    family: 'text after raw HTML, in documents with more than one cause',
    match: /^.+: text \| (text|<\/li>|<\/p>)$/,
    follows: 'mixed',
    why:
      'Long documents that differ in more than one way, the first difference inside text, so ' +
      'no one ablation names it and the signature says little. Every sample read was a micromark ' +
      'family above: a lazy line after a raw-HTML line, a line ending dropped in an HTML block, ' +
      '`</textarea>` (not an HTML block start, CommonMark 4.6) ending a paragraph, or the ' +
      'empty-item interrupt.',
  },
  {
    family: 'rare ablations',
    match: /^(entity|backslash escape)$/,
    follows: 'mixed',
    why:
      'Defusing every `&` or `\\` happened to remove the difference. The samples read were ' +
      'families above: the indented-code loose item (flowdown bug) and the code span across an ' +
      'indented line.',
  },
  {
    family: 'several of the above',
    match: /^(several of the above|tab)$/,
    follows: 'mixed',
    why:
      'Documents that differ in more than one judged family at once and in nothing else, mostly ' +
      'the two tab families together (which the `tab` ablation, defusing every tab, takes as one).',
  },
]

// Random text, biased toward where parsers part.

const WORDS = ['a', 'b', 'foo', 'bar', 'x y', 'word', 'two words', '1', 'é', 'ß']
const INLINE = [
  '*',
  '**',
  '***',
  '_',
  '__',
  '*a*',
  '_a_',
  '**a**',
  '__a__',
  '*a **b** c*',
  '**a *b* c**',
  '_a_b',
  'a_b_',
  '*a_b*',
  'foo*bar*',
  '* a *',
  '~~s~~',
  '~s~',
  '~~~',
  '`c`',
  '``c`d``',
  '` `',
  '`',
  '`a|b`',
  '[l](u)',
  '[l](<u v>)',
  '[l](u "t")',
  "[l](u 't')",
  '[l](u (t))',
  '[l]( u )',
  '[l][r]',
  '[r][]',
  '[r]',
  '[R]',
  '[l]',
  '[',
  ']',
  '](',
  '[*a](u)*',
  '*[a*](u)',
  '[a [b](u) c](v)',
  '![i](u)',
  '![*i*](u "t")',
  '![i][r]',
  '<http://a.b/c>',
  '<a@b.co>',
  'www.a.com',
  'www.a.com/b(c)',
  'https://a.b/c?d=e.',
  'http://a.b/*x*',
  'a@b.co',
  'a.b-c@d.e_f',
  '&amp;',
  '&copy;',
  '&ouml;',
  '&nbsp;',
  '&#35;',
  '&#x22;',
  '&#0;',
  '&bogus;',
  '&#xFFFFFF;',
  '&',
  '\\*',
  '\\_',
  '\\\\',
  '\\[',
  '\\]',
  '\\`',
  '\\|',
  '\\#',
  '\\<',
  '\\&amp;',
  '\\a',
  '<span>',
  '</span>',
  '<a href="x">',
  '</a>',
  '<b a=1>',
  '<!-- c -->',
  '<?p ?>',
  '<x-y/>',
  '<a b',
  '"',
  "'",
  '(',
  ')',
  '!',
  '.',
  '|',
  '\t',
  '—',
  '“',
]

const inline = (r: Random): string => {
  const parts: string[] = []
  const length = r.int(1, 6)
  for (let i = 0; i < length; i++) {
    const roll = r.next()
    const part = roll < 0.4 ? r.pick(WORDS) : r.pick(INLINE)
    // Delimiters run against words as often as they stand apart, which flanking turns on.
    parts.push(part, r.next() < 0.6 ? ' ' : '')
  }
  return parts.join('').trimEnd()
}

const paragraph = (r: Random): string[] => {
  const lines = Array.from({ length: r.int(1, 3) }, () => inline(r))
  // A hard break, by two spaces or a backslash, on a line that is followed by another.
  if (lines.length > 1 && r.next() < 0.3)
    lines[0] = lines[0] + r.pick(['  ', '  ', '\\', '\\', '\t'])
  return lines
}

const indent = (r: Random): string => r.pick(['', '', '', ' ', '  ', '   ', '    ', '\t', ' \t'])

const fence = (r: Random): string[] => {
  const char = r.next() < 0.7 ? '`' : '~'
  const open = char.repeat(r.int(3, 5))
  const info = r.pick(['', 'js', ' ts title="a"', 'a`b', '{x}', ' '])
  const body = Array.from({ length: r.int(0, 3) }, () =>
    r.pick([
      'code',
      '',
      '  indented',
      '\ttab',
      '```',
      '~~~',
      '- not a list',
      '> not a quote',
      '</div>',
    ]),
  )
  const close = r.next() < 0.15 ? [] : [indent(r).slice(0, 3) + char.repeat(r.int(3, 6))]
  return [indent(r).slice(0, r.int(0, 4)) + open + info, ...body, ...close]
}

const table = (r: Random): string[] => {
  const columns = r.int(1, 4)
  const outer = r.next() < 0.6
  const row = (cells: string[]) =>
    outer ? `| ${cells.join(' | ')} |` : cells.join(' | ') + (r.next() < 0.2 ? ' |' : '')
  const cell = () =>
    r.pick(['a', 'b', '`a|b`', 'a \\| b', '*e*', '', ' ', '[l](u)', '**s**', '&amp;'])
  const header = row(Array.from({ length: columns }, cell))
  const delimiter = row(
    Array.from({ length: r.next() < 0.1 ? columns + 1 : columns }, () =>
      r.pick(['-', '---', ':-', '-:', ':-:', ' --- ', '-- -']),
    ),
  )
  const body = Array.from({ length: r.int(0, 3) }, () =>
    row(Array.from({ length: r.int(Math.max(1, columns - 1), columns + 1) }, cell)),
  )
  return [header, delimiter, ...body]
}

const html = (r: Random): string[] =>
  r.pick([
    ['<div>', inline(r), '</div>'],
    ['<div>', '', inline(r), '', '</div>'],
    ['<div>' + inline(r)],
    ['<pre>', '  x', '</pre>'],
    ['<pre>a', '', 'b</pre> c'],
    ['<script>', 'a *b*', '</script>'],
    ['<style>x</style>', inline(r)],
    ['<textarea>', '*a*', '</textarea>'],
    ['<!-- a', '', 'b -->'],
    ['<?php', 'x ?>'],
    ['<!DOCTYPE html>'],
    ['<![CDATA[', 'x', ']]>'],
    ['<x-tag>', inline(r)],
    ['<a href="u">', inline(r)],
    ['</td>' + inline(r)],
    ['<table><tr><td>', '', '*a*', '', '</td></tr></table>'],
    ['<details>', '<summary>S</summary>', '', inline(r), '', '</details>'],
    ['<DIV CLASS="x">'],
  ])

const leaf = (r: Random): string[] => {
  const roll = r.next()
  if (roll < 0.22) return paragraph(r)
  if (roll < 0.3)
    return [
      indent(r).slice(0, 4) +
        '#'.repeat(r.int(1, 7)) +
        r.pick([' ', '', '\t']) +
        inline(r) +
        r.pick(['', ' #', ' ##', '#', ' \\#']),
    ]
  if (roll < 0.36)
    return [
      ...paragraph(r),
      indent(r).slice(0, 4) + r.pick(['===', '---', '=', '-', '= =', '--- ']),
    ]
  if (roll < 0.42)
    return [
      indent(r).slice(0, 4) +
        r.pick(['***', '---', '___', '- - -', '* * *', '_ _ _', '*-*', '--', '****', '-- --']),
    ]
  if (roll < 0.52) return fence(r)
  if (roll < 0.57)
    return ['    ' + r.pick(['code', '*a*', '- b']), r.pick(['', '    more', '  less', '\tx'])]
  if (roll < 0.67) return html(r)
  if (roll < 0.73)
    return [
      r.pick([
        '[r]: /u',
        '[R]: <u v> "t"',
        '[r]:\n/u',
        "[r]: /u 't'",
        '[r]: /u (t) x',
        '[r]:',
        '[ r ]: /u "a\n\nb"',
        '[r]: /u\n"t"',
      ]),
    ]
  if (roll < 0.86) return table(r)
  if (roll < 0.9) return ['']
  return [r.pick(['- [ ] ', '- [x] ', '* [X] ', '1. [ ] ', '- [x]', '- [ ]\t', '[x] ']) + inline(r)]
}

/** A container around lines: a list item or a quote, its continuation sometimes lazy. */
const contain = (r: Random, lines: string[]): string[] => {
  if (r.next() < 0.5) {
    const prefix = r.pick(['> ', '>', '> ', '>\t', ' > ', '>  '])
    return lines.map((line, i) =>
      i > 0 && r.next() < 0.2 ? line : line === '' && r.next() < 0.5 ? '>' : prefix + line,
    )
  }
  const marker = r.pick(['-', '*', '+', '1.', '2)', '10.', '0.', '123456789.', '-'])
  const gap = r.pick([' ', ' ', ' ', '  ', '   ', '    ', '     ', '\t'])
  const width = marker.length + (gap === '\t' ? 2 : gap.length > 4 ? 1 : gap.length)
  const continuation = ' '.repeat(width)
  return lines.map((line, i) => {
    if (i === 0) return marker + (line === '' ? r.pick(['', ' ']) : gap + line)
    if (line === '') return ''
    const roll = r.next()
    // Lazy, one short, or as deep as the content: each reads the next line differently.
    if (roll < 0.15) return line
    if (roll < 0.25) return ' '.repeat(Math.max(0, width - 1)) + line
    return continuation + line
  })
}

const block = (r: Random, depth: number): string[] => {
  if (depth < 3 && r.next() < 0.45) {
    const inner = Array.from({ length: r.int(1, 3) }, () => block(r, depth + 1)).flatMap(
      (lines, i) => (i > 0 && r.next() < 0.5 ? ['', ...lines] : lines),
    )
    return contain(r, inner)
  }
  return leaf(r)
}

const mutate = (r: Random, lines: string[]): string[] => {
  const out = [...lines]
  const times = r.next() < 0.5 ? 0 : r.int(1, 3)
  for (let i = 0; i < times && out.length > 0; i++) {
    const at = r.int(0, out.length - 1)
    const roll = r.next()
    if (roll < 0.3) out.splice(at, 1)
    else if (roll < 0.6) out.splice(at, 0, out[at] as string)
    else if (roll < 0.8) out[at] = r.pick([' ', '  ', '    ', '\t']) + out[at]
    else out[at] = (out[at] as string).replace(/^[ \t]{1,2}/, '')
  }
  return out
}

const generate = (r: Random): string => {
  const blocks = Array.from({ length: r.int(1, 5) }, () => block(r, 0))
  const lines = blocks.flatMap((part, i) => (i > 0 && r.next() < 0.7 ? ['', ...part] : part))
  return mutate(r, lines).join('\n') + (r.next() < 0.8 ? '\n' : '')
}

// Comparing.

const named: Record<string, string> = { quot: '"', apos: "'" }

/**
 * The same HTML written two ways becomes one string: the newlines between tags, the order of a
 * tag's attributes, `<br />` and `<br>`, and a character as itself or as a reference (but `<`,
 * `>` and `&`, whose references are markup).
 */
const normalize = (written: string): string =>
  written
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|(quot|apos));/gi, (whole, dec, hex, name) => {
      if (name) return named[name.toLowerCase()] ?? whole
      // Raw HTML passes a reference through as written, out of range or not.
      const code = dec ? Number(dec) : parseInt(hex, 16)
      if (code === 0 || code > 0x10ffff || code === 60 || code === 62 || code === 38) return whole
      return String.fromCodePoint(code)
    })
    .replace(
      /<([a-z][a-z0-9-]*)((?:\s+[^\s=/>]+(?:="[^"]*")?)*)\s*\/?>/g,
      (_, tag, attrs: string) => {
        const sorted = (attrs.match(/[^\s=/>]+(?:="[^"]*")?/g) ?? []).sort()
        return `<${tag}${sorted.map((attr) => ' ' + attr).join('')}>`
      },
    )
    .replace(/>\n+</g, '><')
    // An HTML block's own last line ending, written or not before its container closes.
    .replace(/\n+(?=<\/(?:li|blockquote|td|th)>)/g, '')
    // And the line ending a writer puts after a block, before the text of a tight item.
    .replace(/(<\/(?:pre|ul|ol|blockquote|table|h[1-6]|div)>)\n+/g, '$1')
    .trim()

/** Where the two outputs part: the element open there, and the token each side writes next. */
const signature = (one: string, other: string): string => {
  let at = 0
  while (at < one.length && one[at] === other[at]) at++
  // Back to the start of the token the difference falls in.
  const lt = one.lastIndexOf('<', at)
  const gt = one.lastIndexOf('>', at - 1)
  const prefix = one.slice(0, lt > gt ? lt : gt + 1)
  const open: string[] = []
  for (const hit of prefix.matchAll(/<(\/?)([a-z][a-z0-9]*)[^>]*>/g)) {
    const tag = hit[2] as string
    if (/^(br|hr|img|input)$/.test(tag)) continue
    if (hit[1] === '') open.push(tag)
    else if (open.lastIndexOf(tag) >= 0) open.length = open.lastIndexOf(tag)
  }
  const token = (text: string) => {
    const rest = text.slice(prefix.length)
    if (rest === '') return 'end'
    const tag = /^<\/?[a-z][a-z0-9]*/.exec(rest)
    return tag ? tag[0] + '>' : 'text'
  }
  return `${open.at(-1) ?? 'root'}: ${token(one)} | ${token(other)}`
}

/**
 * Constructs a difference can be laid at the door of: when the text with one of them taken out
 * draws alike, the difference is that construct's, whatever the markup around it.
 */
const ABLATIONS: [string, (markdown: string) => string][] = [
  // `www.`, `scheme://` and `@` start GFM's bare links; without them none is read.
  [
    'bare link',
    (markdown) => markdown.replace(/www\./gi, 'wxw.').replace(/:\/\//g, ':/x/').replace(/@/g, '%'),
  ],
  ['tab before a line ending', (markdown) => markdown.replace(/\t+(?=\n|$)/g, '')],
  ['tab after a task marker', (markdown) => markdown.replace(/(\[[ xX]\])\t/g, '$1 ')],
  [
    'task marker with nothing after it',
    (markdown) => markdown.replace(/(\[[ xX]\])(?=[ \t]*(?:\n|$))/g, '$1 z'),
  ],
  ['task marker', (markdown) => markdown.replace(/\[([ xX])\]/g, '{$1}')],
  [
    'empty list item',
    (markdown) =>
      markdown.replace(/^((?:[ \t]*>)*[ \t]*(?:[-*+]|\d{1,9}[.)]))(?=[ \t]*$)/gm, '$1 q'),
  ],
  // A delimiter row with a colon and no pipe (`:-`), made text.
  ['table without a pipe', (markdown) => markdown.replace(/^([ \t>]*)(:-+:?|-+:)[ \t]*$/gm, '$&x')],
  ['table', (markdown) => markdown.replace(/\|/g, '¦')],
  [
    'fenced code',
    (markdown) =>
      markdown.replace(
        /^((?:[ \t]*>)*[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?)(`{3,}|~{3,})/gm,
        "$1'''",
      ),
  ],
  ['code span', (markdown) => markdown.replace(/`/g, "'")],
  ['HTML', (markdown) => markdown.replace(/</g, '‹')],
  ['link reference definition', (markdown) => markdown.replace(/\]:/g, ']=')],
  ['entity', (markdown) => markdown.replace(/&/g, '+')],
  ['backslash escape', (markdown) => markdown.replace(/\\/g, '/')],
  ['tab', (markdown) => markdown.replace(/\t/g, '    ')],
  [
    'blockquote',
    // Every `>` among a line's container markers; one pattern, as nested ones backtrack for ever.
    (markdown) => markdown.replace(/^[ \t>*+\-0-9.)]*/gm, (prefix) => prefix.replace(/>/g, '')),
  ],
]

interface Outcome {
  ours: string
  theirs: string
  /** The class of the difference, null when the two draw alike. */
  signature: string | null
}

const draw = (markdown: string) =>
  [normalize(flowdown(markdown)), normalize(reference(markdown))] as const

/**
 * Differences named by the outputs alone: when one side's HTML, rewritten so, is the other's.
 */
const REWRITES: [string, (ours: string, theirs: string) => boolean][] = [
  // micromark ends an indented code block at a line after a container closes, or at a blank one.
  [
    'indented code split in two',
    (ours, theirs) => {
      const join = (written: string) =>
        written.replace(/\n<\/code><\/pre><pre><code>/g, '\n').replace(/\n(?:[ \t]*\n)+/g, '\n')
      return join(theirs) === join(ours)
    },
  ],
  // The two differ in line endings and the indentation after them, nothing else.
  [
    'line endings only',
    (ours, theirs) => ours.replace(/\n[ \t]*/g, '') === theirs.replace(/\n[ \t]*/g, ''),
  ],
]

/**
 * The classes met most often, judged already, taken out of a text that differs in more than
 * one way, so that its signature is that of what is left.
 */
const NOISE = ['bare link', 'tab before a line ending', 'tab after a task marker']
const quiet = (markdown: string) =>
  ABLATIONS.filter(([name]) => NOISE.includes(name)).reduce(
    (text, [, ablate]) => ablate(text),
    markdown,
  )

/** Ablations that change the markup around any difference, so its signature, whatever it is. */
const BROAD = ['HTML', 'entity', 'backslash escape', 'tab', 'blockquote']

const structural = (markdown: string, ours: string, theirs: string): string => {
  const text = quiet(markdown)
  const [one, other] = text === markdown ? [ours, theirs] : draw(text)
  if (one === other) return 'several of the above'
  const found = signature(one, other)
  // Where no one construct accounts for all of it, the first that changes where the two part
  // accounts for the first difference.
  for (const [name, ablate] of ABLATIONS) {
    if (NOISE.includes(name) || BROAD.includes(name)) continue
    const ablated = ablate(text)
    if (ablated === text) continue
    const [a, b] = draw(ablated)
    if (a !== b && signature(a, b) !== found) return `${name}, among others`
  }
  return found
}

const compare = (markdown: string): Outcome => {
  const [ours, theirs] = draw(markdown)
  if (ours === theirs) return { ours, theirs, signature: null }
  for (const [name, same] of REWRITES)
    if (same(ours, theirs)) return { ours, theirs, signature: name }
  for (const [name, ablate] of ABLATIONS) {
    const text = ablate(markdown)
    if (text === markdown) continue
    const [one, other] = draw(text)
    if (one === other) return { ours, theirs, signature: name }
  }
  return { ours, theirs, signature: structural(markdown, ours, theirs) }
}

/**
 * Whether a text still differs in the class named, cheaply: by the ablation that names it, or by
 * its signature. Whether an earlier ablation would claim it instead is checked once, at the end.
 */
const inClass = (markdown: string, wanted: string): boolean => {
  const [ours, theirs] = draw(markdown)
  if (ours === theirs) return false
  const rewrite = REWRITES.find(([name]) => name === wanted)
  if (rewrite !== undefined) return rewrite[1](ours, theirs)
  const ablation = ABLATIONS.find(([name]) => name === wanted)
  if (ablation === undefined) return structural(markdown, ours, theirs) === wanted
  const text = ablation[1](markdown)
  if (text === markdown) return false
  const [one, other] = draw(text)
  return one === other
}

/**
 * The fewest lines that still differ in the same class, then the fewest words and characters.
 * Each round walks the text once from its end, keeping every cut that holds.
 */
const minimize = (markdown: string, wanted: string): string => {
  const cut = (text: string, unit: RegExp, still: (text: string) => boolean) => {
    for (let changed = true; changed;) {
      changed = false
      for (const hit of [...text.matchAll(unit)].toReversed()) {
        const shorter = text.slice(0, hit.index) + text.slice(hit.index + hit[0].length)
        if (still(shorter)) {
          text = shorter
          changed = true
        }
      }
    }
    return text
  }
  const lines = cut(markdown, /[^\n]*\n|[^\n]+$/g, (text) => compare(text).signature === wanted)
  const cheap = (text: string) => inClass(text, wanted)
  const words = cut(lines, /\S+[ \t]*/g, cheap)
  // Characters one by one only once the text is short: each cut is two parses or more.
  const chars = words.length > 400 ? words : cut(words, /[\s\S]/g, cheap)
  if (compare(chars).signature === wanted) return chars
  return compare(words).signature === wanted ? words : lines
}

interface Class {
  signature: string
  count: number
  first: number
  repros: string[]
}

const started = performance.now()
const classes = new Map<string, Class>()
const random = seeded(seed)
let differing = 0
let bytes = 0
let crashes = 0
for (let n = 0; n < count; n++) {
  const markdown = generate(random)
  bytes += markdown.length
  let outcome: Outcome
  try {
    outcome = compare(markdown)
  } catch (error) {
    // A crash is a class of its own: no text may throw in either parser.
    crashes++
    console.error(JSON.stringify(markdown), error)
    continue
  }
  if (outcome.signature === null) continue
  differing++
  const found = classes.get(outcome.signature) ?? {
    signature: outcome.signature,
    count: 0,
    first: n,
    repros: [],
  }
  found.count++
  if (found.repros.length < show) found.repros.push(minimize(markdown, outcome.signature))
  classes.set(outcome.signature, found)
}
const seconds = (performance.now() - started) / 1000

const familyOf = (named: string) => {
  const cause = named.replace(/, among others$/, '')
  return KNOWN.find((entry) =>
    typeof entry.match === 'string' ? entry.match === cause : entry.match.test(cause),
  )
}

interface Family {
  name: string
  known: Known | undefined
  count: number
  classes: Class[]
}
const families = new Map<string, Family>()
for (const found of classes.values()) {
  const known = familyOf(found.signature)
  const name = known?.family ?? found.signature
  const family = families.get(name) ?? { name, known, count: 0, classes: [] }
  family.count += found.count
  family.classes.push(found)
  families.set(name, family)
}
const sorted = [...families.values()].sort((a, b) => b.count - a.count)
for (const family of sorted) family.classes.sort((a, b) => b.count - a.count)
const fresh = sorted.filter((family) => family.known === undefined)
/** The shortest repro of a family, with what each parser draws of it. */
const example = (family: Family) => {
  const repro = family.classes
    .flatMap((found) => found.repros)
    .reduce((best, text) => (text.length < best.length ? text : best))
  return { repro, ...compare(repro), third: normalize(third.render(repro)) }
}

for (const family of sorted) {
  console.log(`${family.known ? '  ' : '+ '}${family.count}\t${family.name}`)
  for (const found of family.classes) {
    if (family.classes.length > 1 || found.signature !== family.name)
      console.log(`      ${found.count}\t${found.signature}`)
    for (const repro of found.repros) {
      const outcome = compare(repro)
      console.log(`    md:        ${JSON.stringify(repro)}`)
      console.log(`    flowdown:  ${JSON.stringify(outcome.ours)}`)
      console.log(`    micromark: ${JSON.stringify(outcome.theirs)}`)
    }
  }
}
console.log(
  `\n${count} documents (${(bytes / 1024 / 1024).toFixed(1)} MB), seed ${seed}, ${seconds.toFixed(1)} s: ` +
    `${differing} differ, in ${classes.size} classes and ${sorted.length} families, ${fresh.length} not judged; ` +
    `${crashes} crashed`,
)

const fenced = (text: string) => {
  const ticks = '`'.repeat(
    Math.max(3, ...[...text.matchAll(/`+/g)].map((hit) => hit[0].length + 1)),
  )
  return `${ticks}\n${text}\n${ticks}`
}

if (!process.argv.includes('--no-write')) {
  const commit = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD']).stdout.toString().trim()
  const dirty =
    Bun.spawnSync(['git', 'status', '--porcelain', '../packages/flowdown/src']).stdout.length > 0
  const report = [
    '# Differential fuzz',
    '',
    "flowdown's engine against micromark with GFM, the reference implementation, on seeded random",
    'documents. `bun run differential` in bench/ writes this file; [src/differential.ts](../src/differential.ts)',
    'says how documents are made, normalized, minimized and grouped, and holds the verdicts below',
    '(`KNOWN`). It exits non-zero on a family no verdict covers.',
    '',
    '- flowdown: `toHtml(parse(md), { tagFilter: true })`, GFM on, no dialect extension, every HTML5',
    '  entity loaded.',
    '- micromark 4.0.3 with micromark-extension-gfm 3.0.0: `allowDangerousHtml` and',
    '  `allowDangerousProtocol`, so both pass raw HTML and every link through. No footnotes are',
    '  generated: the two write different footnote markup by design.',
    '- markdown-it 15 (`html: true`) is shown as a third reading. It has tables but no task lists and',
    '  no bare links as set up, so it settles CommonMark questions only.',
    '',
    `- **date:** ${new Date().toISOString()}`,
    `- **commit:** ${commit}${dirty ? ' (with uncommitted changes under packages/flowdown/src)' : ''}`,
    `- **cpu:** ${cpus()[0]?.model}, ${cpus().length} cores, ${platform()} ${release()}`,
    `- **runtime:** bun ${Bun.version}`,
    `- **documents:** ${count}, ${(bytes / 1024 / 1024).toFixed(1)} MB, seed ${seed}`,
    `- **time:** ${seconds.toFixed(1)} s, minimizing included`,
    `- **differ:** ${differing} (${((differing / count) * 100).toFixed(1)}%), in ${classes.size} classes and ${sorted.length} families; ${fresh.length} families not judged; ${crashes} crashed`,
    '',
    '## How a difference is named',
    '',
    'A rewrite names it when one output, rewritten so, is the other. An ablation names it when the',
    'text with one construct defused (bare-link triggers, a tab, a task marker, a pipe, a fence, a',
    'backtick, `<`, `&`, `\\`, `>`) draws alike in both. Otherwise its signature is the element open',
    'where the outputs part and the token each side writes there (`flowdown | micromark`), read after',
    'the commonest judged causes are defused. Families gather classes of one cause.',
    '',
    '## Families',
    '',
    '| Family | Documents | Follows the spec |',
    '| --- | ---: | --- |',
    ...sorted.map(
      (family) =>
        `| ${family.name} | ${family.count} | ${family.known?.follows ?? '**not judged**'} |`,
    ),
    '',
    ...sorted.flatMap((family) => {
      const shown = example(family)
      return [
        `### ${family.name}`,
        '',
        `${family.count} documents. **Follows the spec:** ${family.known?.follows ?? 'not judged'}.`,
        '',
        family.known?.why ?? 'Not judged yet.',
        '',
        ...(family.classes.length > 1 || family.classes[0]?.signature !== family.name
          ? [
              'Classes: ' +
                family.classes
                  .map((found) => `\`${found.signature}\` (${found.count})`)
                  .join(', ') +
                '.',
              '',
            ]
          : []),
        'Minimal repro, as a JSON string:',
        '',
        fenced(JSON.stringify(shown.repro)),
        '',
        'flowdown, micromark, markdown-it (normalized):',
        '',
        fenced(
          [shown.ours, shown.theirs, shown.third]
            .map((written) => JSON.stringify(written))
            .join('\n'),
        ),
        '',
      ]
    }),
  ]
  writeFileSync(join(import.meta.dir, '../results/differential.md'), report.join('\n'))
}

process.exit(fresh.length > 0 || crashes > 0 ? 1 : 0)
