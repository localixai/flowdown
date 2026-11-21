import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createStream,
  highlight,
  highlightCode,
  languageOf,
  languages,
  lines,
  names,
} from './index'

const AGENT = join(import.meta.dir, '..', 'test', 'agent')
/** What an agent writes, one file a language: `typescript-module.ts` is TypeScript. */
const agent = readdirSync(AGENT).map((file) => ({
  file,
  language: languageOf(
    file.replace(/-.*$/, '').replace('tsx', 'ts').replace('jsx', 'js').replace('html', 'xml'),
  )!,
  code: readFileSync(join(AGENT, file), 'utf8'),
}))

/** The text HTML shows: tags dropped, entities read. */
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

/** The spans of one line, as `kind:text`. */
const spans = (code: string, language: string) =>
  [...highlight(code, language)!.matchAll(/<span class="hljs-([\w -]+)">([^<]*)<\/span>/g)].map(
    ([, kind, text]) => `${kind}:${textOf(text!)}`,
  )

test('the agent corpus has a file in each language it is about', () => {
  expect(agent.length).toBeGreaterThan(20)
  for (const sample of agent) expect(sample.language, sample.file).not.toBeNull()
})

test('a highlighted text is the code, character for character, in every language', () => {
  const nasty = 'a<b>&"\'`${x}\n/* c\n*/ "\\" \\\n<<EOF\n$(a)\nEOF\n\t#x\n'
  for (const language of languages) {
    for (const sample of agent)
      expect(textOf(highlight(sample.code, language)!), `${sample.file} as ${language}`).toBe(
        sample.code,
      )
    expect(textOf(highlight(nasty, language)!), language).toBe(nasty)
  }
})

test('the code is escaped: markup in it never reaches the page as markup', () => {
  const attack = '<img src=x onerror=alert(1)> </script><script>alert(2)</script> " \' &'
  for (const language of languages) {
    const html = highlight(attack, language)!
    expect(html.replace(/<span class="[\w -]+">|<\/span>/g, ''), language).not.toMatch(/[<>"']/)
  }
  expect(highlightCode(attack, 'no-such-language')).not.toContain('<')
})

test('a text that streams is coloured exactly as the whole text, whatever the pieces', () => {
  let seed = 7
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (const sample of agent) {
    const stream = createStream(sample.language)!
    const done: string[] = []
    let current = ''
    for (let at = 0; at < sample.code.length;) {
      const size = 1 + Math.floor(random() * 12)
      const update = stream.write(sample.code.slice(at, at + size))
      done.push(...update.done)
      current = update.current
      at += size
    }
    expect([...done, current].join('\n'), sample.file).toBe(
      highlight(sample.code, sample.language)!,
    )
  }
})

test('line by line, from the state the line above ended in, is the whole text', () => {
  for (const sample of agent) {
    const reader = lines(sample.language)!
    let state = reader.start
    const html = sample.code.split('\n').map((line) => {
      const read = reader.line(line, state)
      state = read.end
      return read.html
    })
    expect(html.join('\n'), sample.file).toBe(highlight(sample.code, sample.language)!)
  }
})

test('a comment, a string or a template opened lines above is still open on the line being written', () => {
  const reader = lines('typescript')!
  const comment = reader.line('/* a comment', reader.start)
  expect(reader.line('that goes on', comment.end).html).toBe(
    '<span class="hljs-comment">that goes on</span>',
  )
  const template = reader.line('const s = `one ${a', reader.start)
  expect(reader.line('+ 1} two`; f()', template.end).html).toContain(
    '<span class="hljs-string"> two`</span>',
  )
  const python = lines('python')!
  const doc = python.line('"""Docs', python.start)
  expect(python.line('still docs', doc.end).html).toBe(
    '<span class="hljs-string">still docs</span>',
  )
  // A one-quote string ends with its line: the next line is code again.
  const open = python.line('x = "never closed', python.start)
  expect(python.line('return x', open.end).html).toContain('hljs-keyword')
})

test('a shell line shows its command and flags; the shell’s own words where a command stands', () => {
  expect(spans('bun add @localix-ai/flowdown --dev', 'sh')).toEqual([
    'title function_:bun',
    'attr:--dev',
  ])
  expect(spans('npm i -D katex && git status | grep -v foo', 'bash')).toEqual([
    'title function_:npm',
    'attr:-D',
    'title function_:git',
    'title function_:grep',
    'attr:-v',
  ])
  expect(spans('$ bun run dev --port 5173', 'sh')).toEqual([
    'title function_:bun',
    'attr:--port',
    'number:5173',
  ])
  expect(spans('NODE_ENV=production bun test', 'zsh')).toEqual(['title function_:bun'])
  expect(spans('if true; then ls; fi', 'shell')).toEqual([
    'keyword:if',
    'literal:true',
    'keyword:then',
    'title function_:ls',
    'keyword:fi',
  ])
  expect(spans('rm -rf node_modules/a-b', 'sh')).toEqual(['title function_:rm', 'attr:-rf'])
  expect(spans('echo "$HOME $(git rev-parse HEAD)"', 'sh')).toEqual([
    'title function_:echo',
    'string:"',
    'variable:$HOME',
    'string: ',
    'subst:$(',
    'title function_:git',
    'subst:)',
    'string:"',
  ])
})

test('a heredoc is text from the line after its opener to its word', () => {
  const html = highlight('cat <<EOF > out.txt\nhello $x\nEOF\nls', 'sh')!.split('\n')
  expect(html[0]).toContain('hljs-title function_">cat')
  expect(html[1]).toBe('<span class="hljs-string">hello $x</span>')
  expect(html[3]).toBe('<span class="hljs-title function_">ls</span>')
})

test('a session colours the commands after a prompt and leaves what they printed', () => {
  const html = highlight(
    '$ npm test\n> app@1.0.0 test\nok 3 tests\nuser@host:~/app$ ls -la',
    'console',
  )!.split('\n')
  expect(html[0]).toBe(
    '<span class="hljs-meta">$</span> <span class="hljs-title function_">npm</span> test',
  )
  expect(html[1]).toBe('&gt; app@1.0.0 test')
  expect(html[2]).toBe('ok 3 tests')
  expect(html[3]).toContain('<span class="hljs-attr">-la</span>')
})

test('a patch shows its added and removed lines and its hunks', () => {
  expect(highlight('@@ -1,2 +1,2 @@\n-old\n+new\n same', 'diff')).toBe(
    '<span class="hljs-meta">@@ -1,2 +1,2 @@</span>\n<span class="hljs-deletion">-old</span>\n' +
      '<span class="hljs-addition">+new</span>\n same',
  )
})

test('names a fence gives find their language; an unknown one is null, never guessed', () => {
  for (const [name, language] of Object.entries({
    ts: 'typescript',
    tsx: 'typescript',
    JS: 'javascript',
    py: 'python',
    'c++': 'cpp',
    'c#': 'csharp',
    yml: 'yaml',
    html: 'xml',
    docker: 'dockerfile',
    golang: 'go',
    'shell-session': 'console',
    toml: 'toml',
    env: 'ini',
  }))
    expect(languageOf(name), name).toBe(language)
  expect(highlight('let x = 1', 'brainfuck')).toBeNull()
  expect(highlightCode('<b>', 'text')).toBe('&lt;b&gt;')
  expect(names.length).toBeGreaterThan(languages.length)
})

test('code built to be slow is read in time that grows with it', () => {
  // Openers that never close, nesting, long runs of what a pattern repeats: in every language.
  const pieces = [
    '/*',
    '"',
    "'",
    '`',
    '${',
    '((',
    '<<',
    '#',
    '--',
    '\\',
    '{',
    '[',
    '<a ',
    '"""',
    'r#"',
    '$(',
    '/a/',
    ': |',
    '@@',
  ]
  const text = Array.from(
    { length: 4000 },
    (_, index) => pieces[index % pieces.length]! + 'x'.repeat(index % 7),
  ).join(' ')
  for (const language of languages) {
    const start = performance.now()
    highlight(text, language)
    highlight(text.replace(/ /g, '\n'), language)
    expect(performance.now() - start, language).toBeLessThan(1500)
  }
})
