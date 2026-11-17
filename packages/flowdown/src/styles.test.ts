import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { transform } from 'lightningcss'

const tokens = readFileSync(join(import.meta.dir, '..', 'styles', 'tokens.css'))

/** What Vite 8 does to the stylesheet by default: Lightning CSS, for browsers without `light-dark()`. */
const lowered = transform({
  filename: 'tokens.css',
  code: tokens,
  minify: true,
  targets: { chrome: 107 << 16 },
}).code.toString()

test('a bundler that lowers light-dark() turns each colour into a pair of fallbacks', () => {
  expect(lowered).not.toContain('light-dark(')
  expect(lowered).toContain(
    '--fd-fg:var(--lightningcss-light,#1c1c1b)var(--lightningcss-dark,#f4f4f2)',
  )
})

test('on a page that declares no colour scheme the pair still resolves, to light', () => {
  // One colour is left only when one of the two variables is the empty value. Without a default
  // both fallbacks apply, `#1c1c1b#f4f4f2`, and nothing that reads a token has a colour.
  expect(lowered).toMatch(/:where\(:root\)\{--lightningcss-dark: ?\}/)
})

test('a dark or light page still sets the pair itself, after the default', () => {
  const dark = lowered.indexOf(
    '--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark',
  )
  const light = lowered.indexOf(
    '--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light',
  )
  expect(dark).toBeGreaterThan(lowered.search(/:where\(:root\)\{--lightningcss-dark/))
  expect(light).toBeGreaterThan(dark)
})

/** The rules a stylesheet gives `selector`, as written: its block's text, '' when it has none. */
const block = (css: string, selector: string): string => {
  const at = css.indexOf(`${selector} {`)
  return at === -1 ? '' : css.slice(at, css.indexOf('}', at))
}

test("a page's own list markers never show beside a form's rows", () => {
  // A page that numbers and bullets its lists does it on `ul` and `ol`, often outside the layer
  // these rules sit in, where it wins over them. A row inherits that marker unless it declares
  // its own, and a declared value beats an inherited one from any layer: so each row says none.
  const forms = readFileSync(join(import.meta.dir, '..', 'styles', 'forms.css'), 'utf8')
  for (const row of [
    '.flowdown .fd-steps > li',
    '.flowdown .fd-stats > li',
    '.flowdown .fd-verdict-list > li',
    '.flowdown .fd-sources > li',
    '.flowdown li.task-list-item',
  ]) {
    expect(block(forms, row), row).toContain('list-style: none;')
  }
})
