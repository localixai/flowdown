/**
 * `@localix-ai/math`: TeX formulas as agents write them, for a page and for a terminal.
 *
 * - `toMathML(tex, { display })`: a `<math>` element every browser lays out itself. Load
 *   `@localix-ai/math/styles.css` for the package's math font, which makes it look the same in
 *   every engine.
 * - `toText(tex)`: the formula on one line of Unicode, `x² + √y`.
 * - `toRows(tex, columns)`: a display formula on rows of a terminal, fractions over their rule.
 *
 * Every function reads any text and never throws; a formula cut off mid-stream draws as far as it
 * goes.
 */
export { toMathML, type MathMLOptions } from './mathml'
export { parse } from './parse'
export { toRows } from './rows'
export { toText } from './text'
export type { MathNode, Variant } from './tree'
