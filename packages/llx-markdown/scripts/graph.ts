import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const transpiler = new Bun.Transpiler({ loader: 'js' })

/** The bare package a specifier names: `react/jsx-runtime` → `react`, `@a/b/c` → `@a/b`. */
export const packageOf = (specifier: string) =>
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : (specifier.split('/')[0] ?? specifier)

/**
 * The built modules an entry reaches through relative imports, and the specifiers of the packages
 * it imports. Read by the parser, not a pattern: an `import('…')` in a comment is not an import.
 * Without `dynamic`, only what loads with the entry: an `import()` is a chunk fetched later.
 */
export function reach(entry: string, { dynamic = true } = {}) {
  const files = new Set<string>()
  const packages = new Set<string>()
  const visit = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    for (const { path, kind } of transpiler.scanImports(readFileSync(file, 'utf8'))) {
      if (!dynamic && kind === 'dynamic-import') continue
      if (path.startsWith('.')) visit(resolve(dirname(file), path))
      else packages.add(path)
    }
  }
  visit(entry)
  return { files, packages }
}
