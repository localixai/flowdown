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
