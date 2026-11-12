/**
 * `bun src/install.ts`: what installing each renderer brings into a project, read from the lockfile
 * and the packages themselves: how many packages land in node_modules (its dependencies, all the
 * way down, without React and the optional peers nobody installs by default), its licence, and the
 * stylesheet it ships. Writes results/install.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface Entry {
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

const root = join(import.meta.dir, '../..')
// bun.lock is JSON with trailing commas.
const lock = JSON.parse(readFileSync(join(root, 'bun.lock'), 'utf8').replace(/,(\s*[}\]])/g, '$1'))
const packages: Record<string, [string, string, Entry?]> = lock.packages

/** The lockfile key a dependency of `parent` resolves to: a copy nested under it, else the hoisted one. */
function resolve(parent: string, name: string): string | undefined {
  const parts = parent.split('/')
  for (let depth = parts.length; depth > 0; depth -= 1) {
    const key = `${parts.slice(0, depth).join('/')}/${name}`
    if (packages[key]) return key
  }
  return packages[name] ? name : undefined
}

function installed(name: string, start: Entry): number {
  const seen = new Set<string>()
  const walk = (key: string, entry: Entry | undefined) => {
    for (const dep of Object.keys({ ...entry?.dependencies, ...entry?.optionalDependencies })) {
      const next = resolve(key, dep)
      if (!next || seen.has(next)) continue
      seen.add(next)
      walk(next, packages[next]![2])
    }
  }
  walk(name, start)
  return seen.size + 1
}

/** Each renderer's package, and the stylesheet its README tells a page to load. */
const RENDERERS = [
  { name: 'flowdown', styles: 'Own stylesheet, light and dark (`flowdown/styles.css`)' },
  { name: 'streamdown', styles: 'Tailwind utility classes: needs Tailwind in the page' },
  { name: 'react-markdown', styles: 'None: plain HTML elements' },
  { name: 'markdown-to-jsx', styles: 'None: plain HTML elements' },
  { name: 'markstream-react', styles: 'Own stylesheet (`markstream-react/index.css`) or Tailwind' },
  { name: 'marked-react', styles: 'None: plain HTML elements' },
]

const figures: Record<string, { packages: number; license: string; styles: string }> = {}
for (const { name, styles } of RENDERERS) {
  const manifest = JSON.parse(
    readFileSync(join(import.meta.dir, `../node_modules/${name}/package.json`), 'utf8'),
  )
  // flowdown is this workspace; its entry is under `workspaces`.
  const entry: Entry =
    name === 'flowdown' ? lock.workspaces['packages/flowdown'] : packages[name]![2]!
  figures[name] = { packages: installed(name, entry), license: manifest.license, styles }
  console.log(
    `${name.padEnd(18)} ${String(figures[name]!.packages).padStart(4)} packages  ${manifest.license}`,
  )
}
writeFileSync(
  join(import.meta.dir, '../results/install.json'),
  `${JSON.stringify(figures, null, 2)}\n`,
)
