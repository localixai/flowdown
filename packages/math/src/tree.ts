/**
 * A formula as the parser reads it: what each output (MathML for a page, rows for a terminal) is
 * written from, so the two never read a formula differently.
 */

/** A letter's typeface: `\mathbf`, `\mathbb` and the rest, written as Unicode's math letters. */
export type Variant =
  | 'normal'
  | 'bold'
  | 'italic'
  | 'bold-italic'
  | 'double-struck'
  | 'script'
  | 'bold-script'
  | 'fraktur'
  | 'sans-serif'
  | 'bold-sans-serif'
  | 'monospace'

/** How an operator sits among its neighbours, which gives it its room. */
export type OperatorKind = 'bin' | 'rel' | 'op' | 'open' | 'close' | 'fence' | 'punct' | 'ord'

export type MathNode =
  /** A letter or a name: one letter leans, a longer name (or `upright`) stands. */
  | { type: 'identifier'; text: string; upright?: boolean }
  | { type: 'number'; text: string }
  | {
      type: 'operator'
      text: string
      kind: OperatorKind
      /** A big operator: whether its limits go above and below (undefined: as TeX would). */
      limits?: boolean
      /** A delimiter that grows with what it encloses (`\left`), or a fixed size in em (`\big`). */
      stretchy?: boolean
      size?: number
    }
  /** `\sin`, `\lim`: an upright name that takes an argument; `limits` for those that take them below. */
  | { type: 'function'; text: string; limits: boolean }
  | { type: 'text'; text: string }
  | { type: 'space'; width: number }
  | { type: 'row'; children: MathNode[] }
  | {
      type: 'fraction'
      numerator: MathNode
      denominator: MathNode
      style?: 'display' | 'text'
      rule: boolean
    }
  | { type: 'root'; body: MathNode; index?: MathNode }
  | { type: 'scripts'; base: MathNode; sub?: MathNode; sup?: MathNode; limits?: boolean }
  | {
      type: 'accent'
      base: MathNode
      char: string
      stretchy: boolean
      under: boolean
      small?: boolean
    }
  | { type: 'stack'; base: MathNode; over?: MathNode; under?: MathNode }
  | { type: 'fenced'; open: string; close: string; body: MathNode }
  | {
      type: 'table'
      rows: MathNode[][]
      align: ReadonlyArray<'left' | 'center' | 'right'>
      kind: 'matrix' | 'cases' | 'aligned' | 'gather' | 'array' | 'small'
      open: string
      close: string
      /** Cells set as a display: `aligned`, `gather`, `dcases`. */
      display: boolean
    }
  | { type: 'variant'; variant: Variant; body: MathNode }
  | { type: 'style'; style: 'display' | 'text' | 'script'; body: MathNode }
  | { type: 'color'; color: string; body: MathNode }
  | { type: 'boxed'; body: MathNode }
  | { type: 'phantom'; body: MathNode }
  /** A command this does not know, shown as it was written. */
  | { type: 'error'; text: string }

export const row = (children: MathNode[]): MathNode =>
  children.length === 1 ? children[0]! : { type: 'row', children }
export const EMPTY: MathNode = { type: 'row', children: [] }
