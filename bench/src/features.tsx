/**
 * `bun src/features.tsx`: what each renderer draws for the same inputs, checked on the DOM it
 * produced, not taken from its documentation. Every renderer is configured as in renderers.tsx (its
 * README's chat setup, no plugins). Writes results/features.md, the table, and
 * results/features.json, which keeps the markup each renderer drew for every check, so a mark in
 * the table can be looked up.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { installIdleTracking } from './idle'

GlobalRegistrator.register({ url: 'https://bench.test/' })
installIdleTracking()
const { RENDERERS } = await import('./renderers')
const { idle } = await import('./idle')
const { flushSync } = await import('react-dom')
const { createRoot } = await import('react-dom/client')
const { renderToString } = await import('react-dom/server')

interface Check {
  group: string
  label: string
  text: string
  /** Rendered while the reply is still arriving. */
  streaming?: boolean
  /** Rendered on the server, with `renderToString`. */
  server?: boolean
  pass: (host: HTMLElement) => boolean
}

const shown = (host: HTMLElement) => host.textContent ?? ''
const has = (host: HTMLElement, selector: string) => host.querySelector(selector) !== null
/** Bold, as any renderer draws it: Streamdown uses a span it marks as `strong`. */
const BOLD = 'strong, b, [data-streamdown="strong"]'
/**
 * A link, as any renderer draws it: Streamdown draws every link as a button that asks before it
 * leaves the page.
 */
const linkTo = (host: HTMLElement, text: string) =>
  [...host.querySelectorAll('a, button')].some((n) => (n.textContent ?? '').includes(text))

const CHECKS: Check[] = [
  // GitHub Markdown, a finished reply.
  {
    group: 'GitHub Markdown',
    label: 'Tables',
    text: '| Plan | Price |\n| --- | --- |\n| Free | $0 |\n',
    pass: (h) => has(h, 'table td'),
  },
  {
    group: 'GitHub Markdown',
    label: 'Task lists',
    text: '- [x] write the plan\n- [ ] tell the team\n',
    pass: (h) => h.querySelectorAll('input[type=checkbox], [role=checkbox]').length === 2,
  },
  {
    group: 'GitHub Markdown',
    label: 'Strikethrough',
    text: 'The ~~old~~ new way.\n',
    pass: (h) => has(h, 'del, s'),
  },
  {
    group: 'GitHub Markdown',
    label: 'Footnotes',
    text: 'A claim.[^1]\n\n[^1]: The source.\n',
    pass: (h) => !shown(h).includes('[^1]') && has(h, 'sup') && shown(h).includes('The source'),
  },
  {
    group: 'GitHub Markdown',
    label: 'Bare links (autolinks)',
    text: 'See https://example.com for more.\n',
    pass: (h) => linkTo(h, 'https://example.com'),
  },
  {
    group: 'GitHub Markdown',
    label: 'Alerts (`> [!WARNING]`)',
    text: '> [!WARNING]\n> Back up first.\n',
    pass: (h) => !shown(h).includes('[!WARNING]') && shown(h).includes('Back up first.'),
  },
  {
    group: 'GitHub Markdown',
    label: 'Raw HTML (`<kbd>`)',
    text: 'Press <kbd>Ctrl</kbd> + <kbd>C</kbd>.\n',
    pass: (h) => h.querySelectorAll('kbd').length === 2,
  },

  // A reply cut off mid-token: what the reader sees in that frame.
  {
    group: 'While streaming',
    label: 'Unfinished bold shows as bold',
    text: 'This is **important',
    streaming: true,
    pass: (h) => has(h, BOLD) && !shown(h).includes('**') && shown(h).includes('important'),
  },
  {
    group: 'While streaming',
    label: 'Unclosed code fence shows as code',
    text: 'Run this:\n\n```ts\nconst answer = 42\n',
    streaming: true,
    pass: (h) => !shown(h).includes('```') && has(h, 'pre, code') && shown(h).includes('answer'),
  },
  {
    group: 'While streaming',
    label: 'Half-typed link shows its text, no brackets',
    text: 'Read [the guide](https://exa',
    streaming: true,
    pass: (h) => shown(h).includes('the guide') && !shown(h).includes('[the guide]'),
  },
  {
    group: 'While streaming',
    label: 'Half-typed table row shows no pipes',
    text: '| Plan | Price |\n| --- | --- |\n| Free | $0',
    streaming: true,
    pass: (h) => has(h, 'table') && !shown(h).includes('|'),
  },

  // Untrusted input: a model can be prompted into writing any of these.
  {
    group: 'Safety',
    label: 'Drops `onerror` and other handlers',
    text: '<img src="x" onerror="alert(1)">\n',
    pass: (h) => ![...h.querySelectorAll('*')].some((n) => n.hasAttribute('onerror')),
  },
  {
    group: 'Safety',
    label: 'Drops `javascript:` links',
    text: '[click me](javascript:alert(1))\n',
    // React 19 swaps a `javascript:` href it would mount for one that only throws; that is safe too.
    pass: (h) =>
      ![...h.querySelectorAll('a[href^="javascript"]')].some(
        (a) => !a.getAttribute('href')!.includes('React has blocked'),
      ),
  },
  {
    group: 'Safety',
    label: 'Never mounts `<script>`',
    text: '<script>alert(1)</script>\n',
    pass: (h) => !has(h, 'script'),
  },

  {
    group: 'Rendering',
    label: 'Renders on the server (`renderToString`)',
    text: '# Title\n\nSome **bold** text.\n',
    server: true,
    pass: (h) => has(h, BOLD) && shown(h).includes('Title'),
  },
]

/** Lets the work a render queued settle, including code a renderer loads on demand. */
async function settle() {
  for (let round = 0; round < 5; round += 1) {
    await idle()
    await new Promise((done) => setTimeout(done, 20))
  }
  await idle()
}

async function draw(Render: (typeof RENDERERS)[number]['Render'], check: Check) {
  const host = document.createElement('div')
  document.body.append(host)
  try {
    if (check.server) {
      host.innerHTML = renderToString(<Render text={check.text} streaming={false} />)
    } else {
      const root = createRoot(host)
      flushSync(() =>
        root.render(<Render text={check.text} streaming={Boolean(check.streaming)} />),
      )
      await settle()
      const html = host.innerHTML
      flushSync(() => root.unmount())
      host.innerHTML = html
    }
    return { pass: check.pass(host), html: host.innerHTML }
  } catch (error) {
    return { pass: false, html: `threw: ${(error as Error).message}` }
  } finally {
    host.remove()
  }
}

// `llx+highlight` draws what `llx` draws, with colours.
const renderers = RENDERERS.filter((r) => r.name !== 'llx+highlight')
const results: Record<string, Record<string, { pass: boolean; html: string }>> = {}
for (const check of CHECKS) {
  results[check.label] = {}
  for (const renderer of renderers)
    results[check.label]![renderer.name] = await draw(renderer.Render, check)
}

const head = `| | ${renderers.map((r) => `${r.name} ${r.version}`).join(' | ')} |`
const rule = `| --- | ${renderers.map(() => ':---:').join(' | ')} |`
const lines: string[] = []
let group = ''
for (const check of CHECKS) {
  if (check.group !== group) {
    group = check.group
    lines.push(`| **${group}** | ${renderers.map(() => '').join(' | ')} |`)
  }
  const marks = renderers.map((r) => (results[check.label]![r.name]!.pass ? '✓' : '✗'))
  lines.push(`| ${check.label} | ${marks.join(' | ')} |`)
}

const dir = join(import.meta.dir, '../results')
writeFileSync(
  join(dir, 'features.md'),
  `# What each renderer draws\n\nThe same inputs through every renderer, configured as its README sets up a chat, with no plugins; each mark is a check on the DOM it drew ([src/features.tsx](../src/features.tsx)). The markup behind every mark is in [features.json](features.json). Regenerate with \`bun run features\`.\n\n${head}\n${rule}\n${lines.join('\n')}\n`,
)
writeFileSync(
  join(dir, 'features.json'),
  `${JSON.stringify({ renderers: renderers.map((r) => ({ name: r.name, version: r.version })), checks: CHECKS.map((c) => ({ group: c.group, label: c.label, text: c.text, streaming: Boolean(c.streaming), server: Boolean(c.server), results: results[c.label] })) }, null, 2)}\n`,
)
console.log(`${head}\n${rule}\n${lines.join('\n')}`)
process.exit(0)
