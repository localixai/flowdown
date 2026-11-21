/**
 * Every package of this repository is made one way (`templates/package`, `bun run new`), and this
 * holds each to it: strict TypeScript from the shared base, no dependency, the same scripts, a size
 * budget, tests in a random order, and shipped code that reads no clock or randomness of its own.
 * A rule broken here fails the root's `bun run test`, which CI runs.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dir, '..')
const packages = readdirSync(join(root, 'packages')).filter((name) =>
  existsSync(join(root, 'packages', name, 'package.json')),
)

/** Scripts every package has, so the root runs each of them over all packages (`scripts/each.ts`). */
const SCRIPTS = ['build', 'test', 'typecheck', 'check', 'size']

/**
 * Shipped files that read the clock, each for its own reason. Anything else that wants time takes
 * it as an option, so a test can hand it a fixed one.
 */
const CLOCKED = new Set([
  // The smooth text's pace is time itself: it reads the frame clock, and a test passes its own.
  'packages/flowdown/src/react/use-smooth-text.ts',
])
const NONDETERMINISTIC = /\bMath\.random\(|\bDate\.now\(|\bnew Date\(\)|\bperformance\.now\(/

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : []
  })

describe.each(packages)('packages/%s', (name) => {
  const dir = join(root, 'packages', name)
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))

  test('is named for its folder, an ES module with no side effects', () => {
    expect(manifest.name).toBe(`@localix-ai/${name}`)
    expect(manifest.type).toBe('module')
    expect(manifest.sideEffects === false || Array.isArray(manifest.sideEffects)).toBe(true)
    expect(manifest.license).toBe('MIT')
    expect(manifest.engines?.node).toBe('>=20')
  })

  test('depends on nothing at run time', () => {
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([])
  })

  test('has the scripts the root runs, and its tests run in a random order', () => {
    for (const script of SCRIPTS) expect(manifest.scripts?.[script], script).toBeString()
    expect(manifest.scripts.test).toContain('--randomize')
  })

  test('compiles under the shared strict base', () => {
    const config = readFileSync(join(dir, 'tsconfig.json'), 'utf8')
    expect(config).toContain('"extends": "../../tsconfig.base.json"')
    for (const loosened of [
      '"strict": false',
      '"noUncheckedIndexedAccess": false',
      '"skipDefaultLibCheck"',
    ]) {
      expect(config).not.toContain(loosened)
    }
  })

  test('ships its readme, license and changelog', () => {
    for (const file of ['README.md', 'LICENSE', 'CHANGELOG.md'])
      expect(existsSync(join(dir, file)), file).toBe(true)
    expect(manifest.files).toContain('dist')
  })

  test('reads no clock and no randomness of its own', () => {
    const offenders = sources(join(dir, 'src'))
      .map((path) => relative(root, path))
      .filter(
        (path) =>
          !CLOCKED.has(path) && NONDETERMINISTIC.test(readFileSync(join(root, path), 'utf8')),
      )
    expect(offenders).toEqual([])
  })
})
