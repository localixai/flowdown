import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { conformance } from '../scripts/conformance'

test('docs/conformance.md is what the code does today (`bun run conformance` rewrites it)', () => {
  const page = readFileSync(new URL('../../../docs/conformance.md', import.meta.url), 'utf8')
  expect(page).toBe(conformance())
})
