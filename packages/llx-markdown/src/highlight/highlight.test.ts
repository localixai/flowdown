import { expect, test } from 'bun:test'
import { highlightCode } from './highlight'

test('shell aliases use Bash grammar for commands, variables, comments and quoted arguments', () => {
  const source = '# Install tools\nsudo apt-get update\necho "$HOME"\n'
  const bash = highlightCode(source, 'bash')
  expect(bash).toContain('hljs-built_in')
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
  expect(spans('bun add llx-markdown --dev')).toEqual(['built_in:bun', 'attr:--dev'])
  expect(spans('npm i -D katex && git status | grep -v foo')).toEqual([
    'built_in:npm',
    'attr:-D',
    'built_in:git',
    'built_in:grep',
    'attr:-v',
  ])
  expect(spans('$ bun run dev --port 5173')).toEqual(['built_in:bun', 'attr:--port', 'number:5173'])
  // An assignment before a command is not the command; a keyword stays a keyword.
  expect(spans('NODE_ENV=production bun test')).toEqual(['built_in:bun'])
  expect(spans('if true; then ls; fi')).toEqual([
    'keyword:if',
    'literal:true',
    'keyword:then',
    'built_in:ls',
    'keyword:fi',
  ])
  // A word inside an argument is not a flag.
  expect(spans('rm -rf node_modules/a-b')).toEqual(['built_in:rm', 'attr:-rf'])
})
