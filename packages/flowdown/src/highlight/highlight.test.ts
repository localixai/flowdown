import { expect, test } from 'bun:test'
import { highlight, highlightCode } from './highlight'

test('shell aliases use Bash grammar for commands, variables, comments and quoted arguments', () => {
  const source = '# Install tools\nsudo apt-get update\necho "$HOME"\n'
  const bash = highlightCode(source, 'bash')
  expect(bash).toContain('hljs-title function_')
  expect(bash).toContain('hljs-comment')
  expect(bash).toContain('hljs-variable')
  expect(bash).toContain('hljs-string')
  for (const alias of ['sh', 'shell', 'zsh', 'BASH']) {
    expect(highlightCode(source, alias)).toBe(bash)
  }
})

test('explicit grammar preserves escaped source and does not detect languages in plain text', () => {
  const source = '<script>alert("code")</script> & exit'
  expect(highlightCode(source, 'text')).toBe(
    '&lt;script&gt;alert(&quot;code&quot;)&lt;/script&gt; &amp; exit',
  )
  expect(highlightCode(source, 'unknown')).toBe(highlightCode(source, 'text'))
  expect(highlightCode(source, 'bash')).not.toContain('<script>')
})

test('documentation fences use their declared grammar', () => {
  expect(highlightCode('export const count: number = 2', 'tsx')).toContain('hljs-keyword')
  expect(highlightCode('{"enabled": true}', 'json')).toContain('hljs-attr')
  expect(highlightCode('enabled: true', 'yaml')).toContain('hljs-attr')
  expect(highlightCode('<main>Preview</main>', 'html')).toContain('hljs-tag')
})

test('a shell line shows its command and flags, not only the shell built-ins', () => {
  const spans = (source: string) =>
    [...highlightCode(source, 'sh').matchAll(/<span class="hljs-([\w ]+)">([^<]*)<\/span>/g)].map(
      ([, kind, text]) => `${kind}:${text}`,
    )
  // The command is drawn as a call is, as an editor draws it.
  expect(spans('bun add @localix-ai/flowdown --dev')).toEqual(['title function_:bun', 'attr:--dev'])
  expect(spans('npm i -D katex && git status | grep -v foo')).toEqual([
    'title function_:npm',
    'attr:-D',
    'title function_:git',
    'title function_:grep',
    'attr:-v',
  ])
  expect(spans('$ bun run dev --port 5173')).toEqual([
    'title function_:bun',
    'attr:--port',
    'number:5173',
  ])
  // An assignment before a command is not the command; a keyword stays a keyword.
  expect(spans('NODE_ENV=production bun test')).toEqual(['title function_:bun'])
  expect(spans('if true; then ls; fi')).toEqual([
    'keyword:if',
    'literal:true',
    'keyword:then',
    'title function_:ls',
    'keyword:fi',
  ])
  // A word inside an argument is not a flag.
  expect(spans('rm -rf node_modules/a-b')).toEqual(['title function_:rm', 'attr:-rf'])
})

test('the popular languages and their aliases have a grammar', () => {
  for (const language of [
    'python',
    'py',
    'go',
    'rust',
    'rs',
    'java',
    'kotlin',
    'swift',
    'c',
    'cpp',
    'c++',
    'csharp',
    'cs',
    'php',
    'ruby',
    'rb',
    'toml',
    'dockerfile',
  ]) {
    expect(highlightCode('return 1 // "x"', language, { unknown: 'null' })).not.toBeNull()
  }
  expect(highlightCode('def run(x):\n    return x', 'py')).toContain('hljs-keyword')
  expect(highlightCode('FROM node:22', 'docker')).toContain('hljs-keyword')
})

test('the highlighter reads a line at a time, so a page colours a growing fence a line once', () => {
  const reader = highlight.lines('ts')!
  const first = reader.line('/* a comment that', reader.start)
  expect(reader.line('goes on */ let x', first.end).html).toBe(
    '<span class="hljs-comment">goes on */</span> <span class="hljs-keyword">let</span> x',
  )
  expect(highlight.lines('no-such-language')).toBeNull()
})
