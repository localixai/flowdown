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
const source = join(
  root,
  'node_modules/@fontsource/stix-two-math/files/stix-two-math-latin-400-normal.woff2',
)
/** What every formula draws from: letters, digits, Greek, operators, brackets and their parts. */
export const CORE = [
  'U+0020-007E',
  'U+00A0-00FF',
  'U+0131',
  'U+0237',
  'U+02C6-02DD',
  'U+0300-036F',
  'U+0391-03C9',
  'U+03D1',
  'U+03D5-03D6',
  'U+03F0-03F1',
  'U+03F5',
  'U+2000-2064',
  'U+20D0-20F0',
  'U+2100-214F',
  'U+2190-21FF',
  'U+2200-22FF',
  'U+2308-230B',
  'U+2322-2323',
  'U+2329-232A',
  'U+239B-23B5',
  'U+23DC-23E1',
  'U+25A0-25A1',
  'U+25B2-25BD',
  'U+25C3',
  'U+25CA',
  'U+2605',
  'U+2660-2667',
  'U+266D-266F',
  'U+2713',
  'U+27E6-27EF',
  'U+27F5-27FF',
  'U+2A00-2A1C',
  'U+2A7D-2A7E',
  'U+2A85-2A8A',
  'U+2AAF-2AB0',
  'U+1D434-1D467',
  'U+1D6E2-1D71B',
]
/** The typefaces `\mathbf`, `\mathcal`, `\mathbb`, `\mathfrak` and `\boldsymbol` give: fetched only by a page that uses them. */
export const LETTERS = [
  'U+1D400-1D433',
  'U+1D468-1D503',
  'U+1D504-1D56B',
  'U+1D6A8-1D6E1',
  'U+1D71C-1D755',
  'U+1D7CE-1D7E1',
]

/**
 * The MATH constants set apart from STIX Two Math's. A browser lowers a subscript to the base's
 * depth plus `SubscriptBaselineDropMin`, and raises a superscript to the base's height less
 * `SuperscriptBaselineDropMax`, for a letter as for a box; TeX does so only for a box. With STIX's
 * values a script on a letter with a tail or a stem stood apart from the rest: `y_i` and `\mu_0`
 * 0.17 em lower than `x_i` and `\varepsilon_0`, `\theta^2` 0.1 em higher than `x^2`. These are TeX's
 * own: no drop below a subscript's base, and a superscript's base dropped by TeX's `sup_drop`, so
 * a script on a single letter sits where `x`'s does, and one on a fraction or a group still clears it.
 * And words over an arrow (`\xrightarrow{f}`) sit 0.12 em over it, as TeX sets them, where STIX
 * raised them to 0.8 em above the baseline whatever their size.
 */
export const CONSTANTS = {
  SubscriptBaselineDropMin: 0,
  SuperscriptBaselineDropMax: 386,
  StretchStackTopShiftUp: 0,
  StretchStackGapAboveMin: 120,
}

const setConstants = (file: string) => {
  const script = `
import sys, json
from fontTools.ttLib import TTFont
font = TTFont(sys.argv[1])
constants = font['MATH'].table.MathConstants
for name, value in json.loads(sys.argv[2]).items():
    getattr(constants, name).Value = value
font.flavor = 'woff2'
font.save(sys.argv[1])
`
  const run = Bun.spawnSync(
    ['python3', '-c', script, join(root, 'fonts', file), JSON.stringify(CONSTANTS)],
    { stdio: ['inherit', 'inherit', 'inherit'] },
  )
  if (run.exitCode !== 0) process.exit(run.exitCode ?? 1)
}

const subset = (ranges: string[], file: string) => {
  const run = Bun.spawnSync(
    [
      'pyftsubset',
      source,
      `--unicodes=${ranges.join(',')}`,
      '--layout-features=*',
      '--flavor=woff2',
      '--no-hinting',
      '--desubroutinize',
      `--output-file=${join(root, 'fonts', file)}`,
    ],
    { stdio: ['inherit', 'inherit', 'inherit'] },
  )
  if (run.exitCode !== 0) process.exit(run.exitCode ?? 1)
  setConstants(file)
  console.log(`fonts/${file}  ${(statSync(join(root, 'fonts', file)).size / 1024).toFixed(1)} KB`)
}
if (import.meta.main) {
  subset(CORE, 'math.woff2')
  subset(LETTERS, 'math-letters.woff2')
  copyFileSync(
    join(root, 'node_modules/@fontsource/stix-two-math/LICENSE'),
    join(root, 'fonts/OFL.txt'),
  )
}
