/**
 * `bun scripts/shots.ts [out-dir] [--chrome=/path/to/chrome]`: pictures to judge the colours by
 * eye. Each file of `test/agent/` coloured by this package (in flowdown's stylesheet, as a page
 * shows it) beside Shiki's colouring (VS Code's grammars, GitHub's theme), in light and in dark;
 * and code caught in the middle of a stream, drawn from the lines `createStream` gave so far.
 *
 * Writes one picture a language and theme (`<language>-<theme>.png`) and sheets of a few
 * languages each (`sheet-<n>-<theme>.png`) into `out-dir` (default `shots/`, ignored).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { createHighlighter } from 'shiki'
import { createStream, highlight, languageOf } from '../src/index'

const root = join(import.meta.dir, '..')
const out = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? join(root, 'shots')
const chrome =
  process.argv.find((arg) => arg.startsWith('--chrome='))?.slice(9) ?? '/usr/bin/google-chrome'
mkdirSync(out, { recursive: true })

/** flowdown's stylesheet: the colours a page with `@localix-ai/flowdown/styles.css` shows. */
const stylesheet = join(root, '..', 'flowdown', 'dist', 'styles.css')
if (!existsSync(stylesheet)) throw new Error('build flowdown first: its stylesheet is the theme')
const css = readFileSync(stylesheet, 'utf8')

const SHIKI: Record<string, string> = {
  bash: 'shellscript',
  console: 'shellsession',
  dockerfile: 'docker',
  xml: 'html',
  json: 'jsonc',
}
const agent = join(root, 'test', 'agent')
const files = readdirSync(agent)
  .toSorted()
  .map((file) => {
    const fence = file.replace(/-.*$/, '')
    const language = languageOf(fence)!
    return {
      file,
      fence,
      language,
      code: readFileSync(join(agent, file), 'utf8').replace(/\n$/, ''),
    }
  })
const shiki = await createHighlighter({
  themes: ['github-light', 'github-dark'],
  langs: [
    ...new Set(
      files.map((file) => SHIKI[file.language] ?? (file.fence === 'tsx' ? 'tsx' : file.language)),
    ),
  ],
})

const escape = (text: string) =>
  text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
const ours = (html: string, language: string) =>
  `<div class="fd-code"><pre><code class="language-${language} fd-highlighted">${html}</code></pre></div>`

/** The middle of a stream: a comment opened in one piece of 40 lines and a template still open. */
const streamed = (() => {
  const lines = Array.from(
    { length: 38 },
    (_, index) => `const value${index} = await load(${index}) // step ${index}`,
  )
  const text = `${lines.join('\n')}\n/* This comment opens on line 39\n   and goes on past the piece\n   where a piece-at-a-time highlighter\n   would lose it. */\nconst message = \`Hello \${user.name}, you have \${count} new\n  messages\` + suffix\nexport function done(`
  const stream = createStream('typescript')!
  const done: string[] = []
  let current = ''
  for (let at = 0; at < text.length; at += 7) {
    const update = stream.write(text.slice(at, at + 7))
    done.push(...update.done)
    current = update.current
  }
  return {
    html: [...done, current].slice(-14).join('\n'),
    whole: highlight(text, 'ts')!.split('\n').slice(-14).join('\n'),
  }
})()

function page(theme: 'light' | 'dark'): string {
  const rows = files
    .map(
      (file) => `
    <section class="row" data-language="${file.file}">
      <h2>${escape(file.file)} <small>${file.language}</small></h2>
      <div class="pair">
        <div class="side"><h3>@localix-ai/highlight · flowdown styles</h3><div class="flowdown">${ours(highlight(file.code, file.language)!, file.language)}</div></div>
        <div class="side"><h3>Shiki · github-${theme}</h3>${shiki.codeToHtml(file.code, {
          lang: (SHIKI[file.language] ?? (file.fence === 'tsx' ? 'tsx' : file.language)) as never,
          theme: `github-${theme}`,
        })}</div>
      </div>
    </section>`,
    )
    .join('')
  const stream = `
    <section class="row" data-language="stream">
      <h2>A file in the middle of its stream <small>typescript, 7 characters a token</small></h2>
      <div class="pair">
        <div class="side"><h3>While it streams: the lines createStream gave</h3><div class="flowdown">${ours(streamed.html, 'ts')}</div></div>
        <div class="side"><h3>The same text highlighted whole</h3><div class="flowdown">${ours(streamed.whole, 'ts')}</div></div>
      </div>
    </section>`
  return `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><style>${css}
    body { margin: 0; padding: 24px; font: 14px system-ui, sans-serif; background: ${theme === 'dark' ? '#0d1117' : '#ffffff'}; color: ${theme === 'dark' ? '#e6edf3' : '#1f2328'}; }
    .row { margin: 0 0 28px; width: 1500px; }
    h2 { font-size: 16px; margin: 0 0 8px; } h2 small { font-weight: 400; opacity: .6; }
    h3 { font-size: 12px; font-weight: 500; opacity: .6; margin: 0 0 6px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .side pre { margin: 0; font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 12px; border-radius: 8px; overflow: hidden; white-space: pre; }
    .side .shiki { margin: 0; }
  </style></head><body>${stream}${rows}</body></html>`
}

const browser = await chromium.launch({ executablePath: chrome })
for (const theme of ['light', 'dark'] as const) {
  const tab = await browser.newPage({
    viewport: { width: 1550, height: 1000 },
    deviceScaleFactor: 1.5,
  })
  await tab.setContent(page(theme))
  const rows = tab.locator('section.row')
  const names: string[] = []
  for (let index = 0; index < (await rows.count()); index++) {
    const row = rows.nth(index)
    const name = (await row.getAttribute('data-language'))!.replace(/\.[^.]+$/, '')
    await row.screenshot({ path: join(out, `${name}-${theme}.png`) })
    names.push(name)
  }
  // Sheets of four languages, to look through quickly.
  for (let sheet = 0; sheet * 4 < names.length; sheet++) {
    await tab.evaluate(
      ([from, to]) => {
        document.querySelectorAll('section.row').forEach((row, index) => {
          ;(row as HTMLElement).style.display = index >= from! && index < to! ? '' : 'none'
        })
      },
      [sheet * 4, sheet * 4 + 4],
    )
    await tab.locator('body').screenshot({ path: join(out, `sheet-${sheet + 1}-${theme}.png`) })
  }
  await tab.close()
}
await browser.close()
console.log(`wrote ${out}`)
