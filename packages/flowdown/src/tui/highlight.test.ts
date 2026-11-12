/**
 * Highlighted code in a terminal, held to what makes it safe to turn on:
 *
 * 1. A token is drawn in the colour of its kind, on every row it reaches.
 * 2. Highlighting changes colours and nothing else: the text of every row, and so its width and
 *    where it breaks, is what it is without a highlighter. Held on seeded code in every language
 *    the package highlights, with tabs, wide characters, markup and control characters in it.
 * 3. A highlighter is not trusted: one that returns other text, markup of its own, an escape
 *    sequence, nothing it should, or that throws, costs the colours and never the code.
 * 4. A reply drawn token by token is what a fresh render draws, with the highlighter on.
 * 5. A token costs little: the fence being written is highlighted in pieces, of which only the
 *    last is highlighted again, and a finished fence is not highlighted twice.
 */
import { describe, expect, test } from 'bun:test'
import { prefixes, type Pattern } from '../../test/chunks'
import { seeded } from '../../test/random'
import { highlight } from '../highlight'
import { codeRows, PIECE_LINES, type Highlighter } from './code'
import {
  createTerminalView,
  lineText,
  lineWidth,
  renderToAnsi,
  renderToLines,
  toAnsi,
  type Line,
  type Style,
} from './index'

const ESC = String.fromCharCode(0x1b)
const TAB = '\t'

const fence = (language: string, code: string): string => `\`\`\`${language}\n${code}\n\`\`\`\n`

/** The rows as `[text, style]` pairs: what a test reads a colour off. */
const drawn = (lines: Line[]): Array<Array<[string, Style]>> =>
  lines.map((line) => line.map((span) => [span.text, span.style]))

const CYAN: Style = { color: 'cyan' }
const GREEN: Style = { color: 'green' }
const YELLOW: Style = { color: 'yellow' }
const MAGENTA: Style = { color: 'magenta' }
const RED: Style = { color: 'red' }
const DIM: Style = { dim: true }
const BOLD: Style = { bold: true }

describe('colours', () => {
  test('a token is drawn in the colour of its kind', () => {
    const code = "// one user\nconst user = await find('id', 42)"
    expect(drawn(renderToLines(fence('ts', code), { width: 60, highlight }))).toEqual([
      [['// one user', DIM]],
      [
        ['const', MAGENTA],
        [' user = ', {}],
        ['await', MAGENTA],
        [' ', {}],
        ['find', BOLD],
        ['(', {}],
        ["'id'", GREEN],
        [', ', {}],
        ['42', YELLOW],
        [')', {}],
      ],
    ])
  })

  test('a diff is green where it adds and red where it removes', () => {
    const rows = renderToLines(fence('diff', '@@ -1 +1 @@\n-old\n+new\n same'), {
      width: 40,
      highlight,
    })
    expect(drawn(rows)).toEqual([
      [['@@ -1 +1 @@', CYAN]],
      [['-old', RED]],
      [['+new', GREEN]],
      [[' same', {}]],
    ])
  })

  test('a shell line shows its command, its flags and its comment', () => {
    const rows = renderToLines(fence('sh', 'bun test --watch # again'), { width: 40, highlight })
    expect(drawn(rows)).toEqual([
      [
        ['bun', CYAN],
        [' test ', {}],
        ['--watch', YELLOW],
        [' ', {}],
        ['# again', DIM],
      ],
    ])
  })

  test('a token that runs over lines is coloured on each of them', () => {
    const rows = renderToLines(fence('js', '/* one\n   two */\nlet a = `x\ny`'), {
      width: 40,
      highlight,
    })
    expect(drawn(rows)).toEqual([
      [['/* one', DIM]],
      [['   two */', DIM]],
      [
        ['let', MAGENTA],
        [' a = ', {}],
        ['`x', GREEN],
      ],
      [['y`', GREEN]],
    ])
  })

  test('a span inside a span is drawn over it, and code inside a string is code again', () => {
    const html =
      '<span class="hljs-string">`a<span class="hljs-subst">${<span class="hljs-number">1</span>}</span>b`</span>' +
      ' <span class="hljs-title class_">Queue</span>' +
      ' <span class="hljs-meta">#<span class="hljs-keyword">if</span></span>' +
      ' <span class="hljs-strong"><span class="hljs-emphasis">x</span></span>'
    const source = '`a${1}b` Queue #if x'
    expect(drawn(codeRows(source, 'any', () => html))).toEqual([
      [
        ['`a', GREEN],
        ['${', {}],
        ['1', YELLOW],
        ['}', {}],
        ['b`', GREEN],
        [' ', {}],
        ['Queue', CYAN],
        [' ', {}],
        ['#', CYAN],
        ['if', MAGENTA],
        [' ', {}],
        ['x', { bold: true, italic: true }],
      ],
    ])
  })

  test('a span of a kind with no colour of its own is drawn as what holds it', () => {
    const html =
      '<span class="hljs-string">a<span class="hljs-char escape_">b</span><span>c</span><b>d</b>e</span>f'
    // Through the renderer: it makes neighbouring runs of one style one run.
    expect(
      drawn(renderToLines(fence('any', 'abcdef'), { width: 40, highlight: () => html })),
    ).toEqual([
      [
        ['abcde', GREEN],
        ['f', {}],
      ],
    ])
  })

  test('what the highlighter escaped is read back as it was written', () => {
    const code = 'a < b && c > d ? "q" : \'s\' // &amp; &#39; &lt;tag&gt; &nope; &#xZZ;'
    const rows = renderToLines(fence('js', code), { width: 200, highlight })
    expect(rows.map(lineText)).toEqual([code])
    expect(rows[0]!.length).toBeGreaterThan(1)
    // Entities written every way a highlighter may write them.
    const html =
      '<span class="hljs-string">&quot;&#39;&#x27;&#X3c;&apos;&amp;&lt;&gt;&#128512;</span>'
    expect(drawn(codeRows("\"''<'&<>\u{1f600}", 'any', () => html))).toEqual([
      [["\"''<'&<>\u{1f600}", GREEN]],
    ])
  })

  test('a tab is run out to its column, whatever token it stands in', () => {
    const code = `if (a) {\n${TAB}return${TAB}"x${TAB}y"${TAB}// c${TAB}d\n}`
    const plain = renderToLines(fence('js', code), { width: 80 })
    const coloured = renderToLines(fence('js', code), { width: 80, highlight })
    expect(coloured.map(lineText)).toEqual(plain.map(lineText))
    expect(coloured.map(lineText)[1]).toBe('    return  "x  y"  // c    d')
    expect(coloured[1]!.some((span) => span.text.includes(TAB))).toBe(false)
  })

  test('code cut at the edge of a row keeps its colours on the next', () => {
    const rows = renderToLines(fence('js', "const s = 'a long string here'"), {
      width: 16,
      highlight,
    })
    expect(drawn(rows)).toEqual([
      [
        ['const', MAGENTA],
        [' s = ', {}],
        ["'a lon", GREEN],
      ],
      [["g string here'", GREEN]],
    ])
  })

  test('without a highlighter, or a language it knows, code is one colour', () => {
    const one = [[['let a = 1', CYAN]]] as unknown
    expect(drawn(renderToLines(fence('js', 'let a = 1'), { width: 40 }))).toEqual(one as never)
    expect(drawn(renderToLines(fence('js', 'let a = 1'), { width: 40, highlight: null }))).toEqual(
      one as never,
    )
    expect(drawn(renderToLines(fence('klingon', 'let a = 1'), { width: 40, highlight }))).toEqual(
      one as never,
    )
    expect(drawn(renderToLines('```\nlet a = 1\n```\n', { width: 40, highlight }))).toEqual(
      one as never,
    )
    // A file tree is not code: it is drawn as a tree, with or without a highlighter.
    expect(renderToAnsi('```tree\nsrc/\n└── a.ts\n```\n', { width: 40, highlight })).toBe(
      renderToAnsi('```tree\nsrc/\n└── a.ts\n```\n', { width: 40 }),
    )
  })

  test('a fence still being written is coloured as it grows', () => {
    const view = createTerminalView({ width: 40, highlight })
    const rows = view.render('```js\nconst a = 1\nconst b', { streaming: true })
    expect(drawn(rows)).toEqual([
      [
        ['const', MAGENTA],
        [' a = ', {}],
        ['1', YELLOW],
      ],
      [
        ['const', MAGENTA],
        [' b', {}],
      ],
    ])
  })
})

/** The languages of `@localix-ai/flowdown/highlight`, each with lines of its own to draw from. */
const LANGUAGES: Record<string, string[]> = {
  ts: [
    "import { a, type B } from './b'",
    'export const f = async <T>(x: T): Promise<T[]> => [x]',
    'class Queue<T> extends Base implements Q { #items: T[] = [] }',
    '/** doc @param x */',
    '/* open',
    'still */ let n = 0x1f + 1_000n',
    'const s = `a ${b ? `c ${d}` : "e"} f`',
    "if (a < b && c > d) return /re[gex]+/gi.test('x')",
    '// comment <b>bold</b> &amp; "quoted"',
  ],
  js: ['function* g() { yield 1 }', 'const o = { "k": null, v: undefined, t: true }', '}'],
  py: [
    'def f(x: int = 0) -> str:',
    '    """doc',
    '    string"""',
    "    return f'{x!r:>10} {{}}'  # note",
    '@decorator',
    'class A(B): pass',
  ],
  sh: [
    'NODE_ENV=production bun test --watch | tee log.txt # run',
    'for f in *.ts; do echo "$f" && cat <<EOF',
    'here $HOME',
    'EOF',
    'done',
    "curl -fsSL 'https://example.com/a?b=1&c=2' > out",
  ],
  json: ['{ "a": [1, 2.5e3, true, null], "b": { "c": "d\\n" } }', '{', '  "open": "'],
  yaml: ['key: value # c', '- item: [1, 2]', 'text: |', '  block <b> & more', 'anchor: &a *a'],
  toml: ['[table]', 'key = "value" # c', 'n = 1_000', 'd = 1979-05-27T07:32:00Z'],
  html: [
    '<!doctype html>',
    '<a href="x?a=1&amp;b=2" class=\'c\'>t &lt; u</a>',
    '<script>let a = "<\\/script>"</script>',
    '<style>a > b { color: #fff }</style>',
    '<!-- note',
  ],
  css: [
    'a.b#c > d::before { color: rgb(1 2 3 / 50%); content: "\\201c" }',
    '@media (min-width: 1px) {',
  ],
  md: ['# Title', '- *a* **b** `c`', '> quote', '[l](https://a.b "t")', '```js'],
  diff: ['--- a/x', '+++ b/x', '@@ -1,2 +1,2 @@', '-old <b>', '+new &amp;', ' same'],
  rust: [
    'fn main() -> Result<(), Box<dyn Error>> {',
    '    let c = \'a\'; let s = r#"raw "q""#;',
    '    println!("{:?}", &x[..]);',
    "impl<'a> T for S<'a> {}",
  ],
  go: [
    'func (s *S) F(ctx context.Context) (int, error) {',
    '\treturn 0, fmt.Errorf("x: %w", err)',
    '`raw',
    'string`',
  ],
  sql: ["SELECT a, COUNT(*) FROM t WHERE b = 'it''s' AND c >= 1 -- note", '/* open'],
  java: ['@Override public <T> List<T> f(final Map<String, ? extends T> m) { return null; }'],
  kotlin: ['fun <T> f(x: T?): String = "v=${x ?: "none"}"'],
  swift: ['func f(_ x: Int?) -> String { "\\(x ?? 0)" }'],
  c: [
    '#include <stdio.h>',
    'int main(void) { printf("%d\\n", 1 << 2); return 0; }',
    '#define M(x) ((x) > 0)',
  ],
  cpp: ['template <typename T> auto f(T&& x) -> std::vector<T> { return {x}; }'],
  csharp: ['public async Task<int?> F(string s) => $"{s}" is { Length: > 0 } ? 1 : null;'],
  php: ['<?php echo "a $b {$c[\'d\']}"; ?>', '$x = fn($y) => $y <=> 1;'],
  ruby: ['def f(x) = "#{x} #{x > 1 ? :a : %w[b c]}"', 'puts <<~EOS', '  here', 'EOS'],
  dockerfile: [
    'FROM oven/bun:1 AS build',
    'RUN bun install && bun run build # c',
    'CMD ["bun", "x.ts"]',
  ],
}

/** What a line of code may also hold: what a terminal measures, expands or would act on. */
const ODD = [
  TAB,
  `${TAB}${TAB}`,
  ` ${TAB}`,
  '漢字',
  '😀',
  'é',
  'é',
  '👨‍👩‍👧',
  '<span class="hljs-keyword">',
  '</span>',
  '&lt;',
  '&',
  `${ESC}[2J`,
  `${ESC}]0;title\u0007`,
  String.fromCharCode(0x202e),
  '\r',
  '\u0000',
  ' '.repeat(7),
  'x'.repeat(90),
]

/** A fence of seeded code: lines of the language, some with something odd put in. */
function seededFence(seed: number): { language: string; code: string } {
  const random = seeded(seed)
  const names = Object.keys(LANGUAGES)
  const language = names[seed % names.length]!
  const lines: string[] = []
  const count = random.int(1, 9)
  for (let at = 0; at < count; at++) {
    let line = random.pick(LANGUAGES[language]!)
    const odd = random.int(0, 3)
    for (let n = 0; n < odd && random.next() < 0.6; n++) {
      const where = random.int(0, line.length)
      line = line.slice(0, where) + random.pick(ODD) + line.slice(where)
    }
    lines.push(random.next() < 0.1 ? '' : line)
  }
  return { language, code: lines.join('\n') }
}

const SEEDS = Number(process.env.TUI_SEEDS ?? 300) * 4

describe('on seeded code', () => {
  test('highlighting changes the colours of a row and never its text', () => {
    const differs: string[] = []
    const languages = new Set<string>()
    let coloured = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { language, code } = seededFence(seed)
      // In a fence of four backticks: a line of the code may be a fence of three.
      const markdown = `> [!NOTE]\n> \`\`\`\`${language}\n${code.replace(/^/gm, '> ')}\n> \`\`\`\`\n\n\`\`\`\`${language}\n${code}\n\`\`\`\`\n`
      for (const width of [9, 34, 100]) {
        const plain = renderToLines(markdown, { width })
        const lit = renderToLines(markdown, { width, highlight })
        if (toAnsi(lit, false) !== toAnsi(plain, false))
          differs.push(`seed ${seed} (${language}) at ${width}`)
        for (const row of lit)
          if (lineWidth(row) > width) differs.push(`seed ${seed} at ${width}: a row too wide`)
        if (toAnsi(lit) !== toAnsi(plain)) {
          coloured++
          languages.add(language)
        }
      }
    }
    expect(differs).toEqual([])
    // The property is about something: nearly every fence is coloured, in every language.
    expect(coloured).toBeGreaterThan(SEEDS * 3 * 0.9)
    expect([...languages].toSorted()).toEqual(Object.keys(LANGUAGES).toSorted())
  })

  /** A character that moves a terminal's cursor or turns its text around: C0, C1, the bidi marks. */
  const isControl = (char: string): boolean => {
    const code = char.codePointAt(0)!
    return (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    )
  }

  test('the only escape sequences in the output are the renderer’s own', () => {
    // An SGR sequence the renderer writes: ESC [ digits and semicolons m.
    const own = new RegExp(`${ESC}\\[[0-9;]*m`, 'g')
    const leaks: string[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { language, code } = seededFence(seed)
      const out = renderToAnsi(fence(language, code), { width: 60, highlight })
      // Every control character but the line feed that parts the rows.
      const left = out.replace(own, '').replace(/\n/g, '')
      if ([...left].some(isControl)) leaks.push(`seed ${seed} (${language})`)
      if (renderToAnsi(fence(language, code), { width: 60, highlight, color: false }).includes(ESC))
        leaks.push(`seed ${seed} (${language}), without colours`)
    }
    expect(leaks).toEqual([])
  })
})

describe('a highlighter is not trusted', () => {
  const code = `const a = "<b>" // ${ESC}[2J\n${TAB}return a`
  const markdown = fence('js', code)
  const plain = toAnsi(renderToLines(markdown, { width: 60 }))

  const liars: Record<string, Highlighter> = {
    'other text': () => '<span class="hljs-keyword">rm</span> -rf /',
    'text added': (source) =>
      `<span class="hljs-comment">injected</span>${highlight(source, 'js')}`,
    'text dropped': (source) => highlight(source.slice(0, -3), 'js'),
    'an escape sequence of its own': (source) =>
      `<span class="hljs-keyword">${ESC}[31m</span>${highlight(source, 'js')}`,
    'the code unescaped': (source) => `<span class="hljs-keyword">${source}</span>`,
    'markup of its own': () => '<script>alert(1)</script><img src=x onerror=alert(1)>',
    'tags that never close': (source) => `<span class="hljs-keyword"><span><span>${source}`,
    'closing tags alone': (source) => `</span></span></span>${source}</span>`,
    nothing: () => '',
    'not a string': () => 42 as unknown as string,
    undefined: () => undefined as unknown as string,
    'an error': () => {
      throw new Error('grammar failed')
    },
    'no colours it names': (source) =>
      `<pre class="shiki"><code><span class="line"><span style="color:#f00">${source
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')}</span></span></code></pre>`,
  }

  for (const [name, liar] of Object.entries(liars)) {
    test(`${name}: the code is drawn plain`, () => {
      expect(toAnsi(renderToLines(markdown, { width: 60, highlight: liar }))).toBe(plain)
      expect(renderToAnsi(markdown, { width: 60, highlight: liar, color: false })).not.toContain(
        ESC,
      )
    })
  }

  test('a highlighter is asked once for a fence, with its code and its language', () => {
    const asked: Array<[string, string]> = []
    const spy: Highlighter = (source, language) => {
      asked.push([source, language])
      return null
    }
    renderToLines('```ts title="a.ts"\nlet a\n```\n\ntext `code`\n\n```\nplain\n```\n', {
      width: 40,
      highlight: spy,
    })
    expect(asked).toEqual([['let a', 'ts']])
  })
})

describe('a reply while it arrives, highlighted', () => {
  test('every step is what a fresh render of that text draws', () => {
    const patterns: Pattern[] = ['token', 'frame', 'line']
    let steps = 0
    for (let seed = 1; seed <= 60; seed++) {
      const a = seededFence(seed)
      const b = seededFence(seed + 1000)
      const markdown = `Before.\n\n${fence(a.language, a.code)}\nBetween **two**.\n\n1. item\n   ${fence(b.language, b.code).replace(/\n/g, '\n   ')}\nAfter.\n`
      const width = [80, 30, 12][seed % 3]!
      const view = createTerminalView({ width, highlight })
      const all = prefixes(markdown, patterns[seed % patterns.length]!, seed)
      all.forEach((prefix, at) => {
        const rows = view.render(prefix, { streaming: true })
        if (at % 5 === 0 || at === all.length - 1) {
          expect(toAnsi(rows)).toBe(
            toAnsi(renderToLines(prefix, { width, streaming: true, highlight })),
          )
          steps++
        }
      })
      expect(toAnsi(view.render(markdown))).toBe(
        toAnsi(renderToLines(markdown, { width, highlight })),
      )
    }
    expect(steps).toBeGreaterThan(300)
  })
})

describe('what a token costs', () => {
  /** `highlight`, with every call it gets written down. */
  const spied = (): { highlight: Highlighter; calls: string[] } => {
    const calls: string[] = []
    return {
      calls,
      highlight: (source, language) => {
        calls.push(source)
        return highlight(source, language)
      },
    }
  }
  const linesOf = (text: string): number => text.split('\n').length
  const code = (lines: number, from = 0): string =>
    Array.from({ length: lines }, (_, at) => `const v${from + at} = f(${from + at}) // ${at}`).join(
      '\n',
    )

  test('the fence being written is highlighted a piece at a time', () => {
    const body = code(PIECE_LINES * 3 + 7)
    const markdown = `Text.\n\n\`\`\`js\n${body}\n\`\`\`\n\nAfter.\n`
    const spy = spied()
    const view = createTerminalView({ width: 60, highlight: spy.highlight })
    const closes = markdown.indexOf('\n```\n')
    let last: Line[] = []
    for (let at = 1; at <= closes; at += 3)
      last = view.render(markdown.slice(0, at), { streaming: true })
    // While it is written: never more than a piece at once, and a whole piece only once.
    expect(Math.max(...spy.calls.map(linesOf))).toBe(PIECE_LINES)
    const whole = spy.calls.filter((call) => linesOf(call) === PIECE_LINES)
    expect(new Set(whole).size).toBe(whole.length)
    // Its text is the code all the while, piece or no piece.
    expect(toAnsi(last, false)).toBe(
      toAnsi(
        renderToLines(markdown.slice(0, closes - ((closes - 1) % 3)), {
          width: 60,
          streaming: true,
        }),
        false,
      ),
    )
    // Closed: highlighted whole, once, and no more however long the reply goes on.
    view.render(markdown.slice(0, closes), { streaming: true })
    spy.calls.length = 0
    for (let at = closes + 5; at <= markdown.length; at++)
      view.render(markdown.slice(0, at), { streaming: true })
    view.render(markdown)
    expect(spy.calls).toEqual([body])
  })

  test('a construct cut by a piece is coloured right once its fence closes', () => {
    const body = `${code(PIECE_LINES - 1)}\n/* opens here\n${code(3, 100)}\ncloses here */\nlet done = 1`
    const open = `\`\`\`js\n${body}`
    const closed = `${open}\n\`\`\`\n`
    const view = createTerminalView({ width: 60, highlight })
    const comment = (rows: Line[]): Style[] =>
      rows.slice(PIECE_LINES - 1, PIECE_LINES + 4).map((row) => row[0]!.style)
    // Written: the comment's first line ends a piece, and the next piece does not know of it.
    const growing = view.render(open, { streaming: true })
    expect(comment(growing)[0]).toEqual(DIM)
    expect(comment(growing)[1]).not.toEqual(DIM)
    expect(toAnsi(growing, false)).toBe(toAnsi(renderToLines(closed, { width: 60 }), false))
    // Closed: every line of it is a comment's.
    expect(comment(view.render(closed))).toEqual([DIM, DIM, DIM, DIM, DIM])
    // And a fresh render of the growing text draws the same pieces: the two never part.
    expect(toAnsi(growing)).toBe(
      toAnsi(renderToLines(open, { width: 60, streaming: true, highlight })),
    )
  })

  test('a finished fence is not highlighted again while its block is', () => {
    const first = code(12)
    const second = code(PIECE_LINES * 2 + 5, 500)
    const inside = (text: string): string => text.replace(/^/gm, '   ')
    // One block: the steps hold both fences, so every token of the second redraws the first.
    const markdown = `> [!STEPS]\n1. **One**\n${inside(fence('js', first))}2. **Two**\n${inside(fence('js', second))}`
    const spy = spied()
    const view = createTerminalView({ width: 70, highlight: spy.highlight })
    const from = markdown.indexOf('2. **Two**')
    view.render(markdown.slice(0, from), { streaming: true })
    expect(spy.calls).toContain(first)
    spy.calls.length = 0
    for (let at = from + 1; at < markdown.length - 8; at += 2)
      view.render(markdown.slice(0, at), { streaming: true })
    // The finished fence is never asked for again; the one being written, a piece at a time.
    expect(spy.calls.filter((call) => call === first)).toEqual([])
    expect(Math.max(...spy.calls.map(linesOf))).toBe(PIECE_LINES)
    expect(toAnsi(view.render(markdown))).toBe(
      toAnsi(renderToLines(markdown, { width: 70, highlight })),
    )
  })

  test('a fence inside a callout or a list is written a piece at a time too', () => {
    const body = code(PIECE_LINES * 2 + 9)
    const nested: Record<string, string> = {
      callout: `> [!TIP]\n${fence('js', body).replace(/^/gm, '> ')}`,
      list: `- item\n\n${fence('js', body).replace(/^/gm, '  ')}`,
    }
    for (const [name, markdown] of Object.entries(nested)) {
      const spy = spied()
      const view = createTerminalView({ width: 70, highlight: spy.highlight })
      for (let at = 1; at < markdown.length; at += 2)
        view.render(markdown.slice(0, at), { streaming: true })
      expect([name, Math.max(...spy.calls.map(linesOf))]).toEqual([name, PIECE_LINES])
      // Done: whole, and what a fresh render draws.
      spy.calls.length = 0
      const done = view.render(markdown)
      expect([name, spy.calls.map(linesOf)]).toEqual([name, [linesOf(body)]])
      expect(toAnsi(done)).toBe(toAnsi(renderToLines(markdown, { width: 70, highlight })))
    }
  })

  test('the same code in another language is highlighted as that language', () => {
    const view = createTerminalView({ width: 40, highlight })
    const body = 'let a = 1 # note'
    for (const language of ['js', 'python', 'js']) {
      const open = `\`\`\`${language}\n${body}`
      expect([language, toAnsi(view.render(open, { streaming: true }))]).toEqual([
        language,
        toAnsi(renderToLines(open, { width: 40, streaming: true, highlight })),
      ])
    }
    // The two languages do colour it differently, or the above says nothing.
    expect(toAnsi(codeRows(body, 'js', highlight))).not.toBe(
      toAnsi(codeRows(body, 'python', highlight)),
    )
  })

  test('a fence the text no longer holds is forgotten', () => {
    const spy = spied()
    const view = createTerminalView({ width: 40, highlight: spy.highlight })
    const fenced = fence('js', 'let a = 1')
    view.render(fenced)
    view.render('No code now.')
    view.render('Still none.')
    view.render(fenced)
    expect(spy.calls).toEqual(['let a = 1', 'let a = 1'])
  })

  test('a long fence streams in pieces, and every step is what a fresh render draws', () => {
    const body = `${code(PIECE_LINES + 3)}\nconst s = \`one\n${code(PIECE_LINES, 200)}\ntwo\`\n${code(9, 300)}`
    const markdown = `Before.\n\n- item\n\n  \`\`\`ts\n${body.replace(/\n/g, '\n  ')}\n  \`\`\`\n\nAfter.\n`
    const view = createTerminalView({ width: 50, highlight })
    const all = prefixes(markdown, 'token', 7)
    let steps = 0
    all.forEach((prefix, at) => {
      const rows = view.render(prefix, { streaming: true })
      if (at % 9 === 0 || at === all.length - 1) {
        expect(toAnsi(rows)).toBe(
          toAnsi(renderToLines(prefix, { width: 50, streaming: true, highlight })),
        )
        steps++
      }
    })
    expect(steps).toBeGreaterThan(50)
    expect(toAnsi(view.render(markdown))).toBe(
      toAnsi(renderToLines(markdown, { width: 50, highlight })),
    )
  })
})
