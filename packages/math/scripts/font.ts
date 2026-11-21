/**
 * `bun scripts/font.ts`: `fonts/math.woff2`, the package's math font, made from STIX Two Math
 * (SIL Open Font License, `fonts/OFL.txt`) cut down to what formulas in replies use: Latin, Greek,
 * the operators, relations and arrows, the math letters `\mathbf`, `\mathbb` and `\mathcal` give,
 * and every larger size and part a bracket, a root or a brace grows from (the font's MATH table,
 * kept whole). Needs Python's fontTools (`pip install fonttools brotli`); the font it writes is
 * committed, so building the package does not.
 */
import { copyFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const source = join(root, 'node_modules/@fontsource/stix-two-math/files/stix-two-math-latin-400-normal.woff2')
/** What every formula draws from: letters, digits, Greek, operators, brackets and their parts. */
export const CORE = [
  'U+0020-007E', 'U+00A0-00FF', 'U+0131', 'U+0237', 'U+02C6-02DD', 'U+0300-036F', 'U+0391-03C9', 'U+03D1',
  'U+03D5-03D6', 'U+03F0-03F1', 'U+03F5', 'U+2000-2064', 'U+20D0-20F0', 'U+2100-214F', 'U+2190-21FF',
  'U+2200-22FF', 'U+2308-230B', 'U+2322-2323', 'U+2329-232A', 'U+239B-23B5', 'U+23DC-23E1', 'U+25A0-25A1',
  'U+25B2-25BD', 'U+25C3', 'U+25CA', 'U+2605', 'U+2660-2667', 'U+266D-266F', 'U+2713', 'U+27E6-27EF',
  'U+27F5-27FF', 'U+2A00-2A1C', 'U+2A7D-2A7E', 'U+2A85-2A8A', 'U+2AAF-2AB0', 'U+1D434-1D467', 'U+1D6E2-1D71B',
]
/** The typefaces `\mathbf`, `\mathcal`, `\mathbb`, `\mathfrak` and `\boldsymbol` give: fetched only by a page that uses them. */
export const LETTERS = ['U+1D400-1D433', 'U+1D468-1D503', 'U+1D504-1D56B', 'U+1D6A8-1D6E1', 'U+1D71C-1D755', 'U+1D7CE-1D7E1']

const subset = (ranges: string[], file: string) => {
  const run = Bun.spawnSync([
    'pyftsubset', source, `--unicodes=${ranges.join(',')}`, '--layout-features=*', '--flavor=woff2',
    '--no-hinting', '--desubroutinize', `--output-file=${join(root, 'fonts', file)}`,
  ], { stdio: ['inherit', 'inherit', 'inherit'] })
  if (run.exitCode !== 0) process.exit(run.exitCode ?? 1)
  console.log(`fonts/${file}  ${(statSync(join(root, 'fonts', file)).size / 1024).toFixed(1)} KB`)
}
if (import.meta.main) {
  subset(CORE, 'math.woff2')
  subset(LETTERS, 'math-letters.woff2')
  copyFileSync(join(root, 'node_modules/@fontsource/stix-two-math/LICENSE'), join(root, 'fonts/OFL.txt'))
}
