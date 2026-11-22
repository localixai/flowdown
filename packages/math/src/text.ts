/**
 * A formula on one line of Unicode, for a terminal's running text, a title, a plain-text copy:
 * `x² + √y`, `∑ᵢ₌₁ⁿ xᵢ`, `(a+b)/2`. What Unicode has a small letter for is written small; what it
 * has not is written after `^` or `_`, bracketed when it is more than one thing.
 */
import { inVariant } from './letters'
import { parse } from './parse'
import { endsInTerm, type MathNode, type Variant } from './tree'

const small = (pairs: string): Map<string, string> => {
  const chars = [...pairs]
  const table = new Map<string, string>()
  for (let at = 0; at + 1 < chars.length; at += 2) table.set(chars[at]!, chars[at + 1]!)
  return table
}
export const SUPER = small(
  '0⁰1¹2²3³4⁴5⁵6⁶7⁷8⁸9⁹+⁺-⁻−⁻=⁼(⁽)⁾aᵃbᵇcᶜdᵈeᵉfᶠgᵍhʰiⁱjʲkᵏlˡmᵐnⁿoᵒpᵖrʳsˢtᵗuᵘvᵛwʷxˣyʸzᶻAᴬBᴮDᴰEᴱGᴳHᴴIᴵJᴶKᴷLᴸMᴹNᴺOᴼPᴾRᴿTᵀUᵁVⱽWᵂ∘°′′⊤ᵀ*˟βᵝγᵞδᵟθᶿφᵠχᵡ',
)
export const SUB = small(
  '0₀1₁2₂3₃4₄5₅6₆7₇8₈9₉+₊-₋−₋=₌(₍)₎aₐeₑhₕiᵢjⱼkₖlₗmₘnₙoₒpₚrᵣsₛtₜuᵤvᵥxₓβᵦγᵧρᵨφᵩχᵪ,,',
)

/** A script in small letters, or after its mark (bracketed when longer than one) where one lacks. */
export function scripted(text: string, table: Map<string, string>, mark: string): string {
  const body = text.replace(/\s+/g, '')
  if (body === '') return ''
  let out = ''
  for (const char of body) {
    const to = table.get(char)
    if (to === undefined) return mark + ([...body].length === 1 ? body : `(${body})`)
    out += to
  }
  return out
}

/** What stands over or under a slash with no brackets: one word, number, or bracketed group. */
const SIMPLE = /^[√∂∇−-]?[\p{L}\p{N}\p{M}.′″]*(?:\([^()]*\))?$/u
export const grouped = (text: string): string => (SIMPLE.test(text) ? text : `(${text})`)

/** Each accent's combining mark, which a terminal sets over its letter. */
const COMBINING: Record<string, string> = {
  ˆ: '\u0302',
  '\u0302': '\u0302',
  ˇ: '\u030c',
  '\u030c': '\u030c',
  '˜': '\u0303',
  '\u0303': '\u0303',
  '´': '\u0301',
  '`': '\u0300',
  '˙': '\u0307',
  '¨': '\u0308',
  '⋯': '\u20db',
  '˘': '\u0306',
  '¯': '\u0304',
  '˚': '\u030a',
  '→': '\u20d7',
}

const takesOperand = (node: MathNode): boolean =>
  (node.type === 'operator' && node.kind === 'op') ||
  (node.type === 'scripts' && node.base.type === 'operator' && node.base.kind === 'op')
const isName = (node: MathNode): boolean =>
  node.type === 'function' || (node.type === 'scripts' && node.base.type === 'function')

/** `tex` on one line. Reads any text and never throws. */
export function toText(tex: string): string {
  return line(parse(tex), null).replace(/ {2,}/g, ' ').trim()
}

/** A node on one line: shared with the rows, which write on one line what has no rows of its own. */
export function line(node: MathNode, variant: Variant | null): string {
  switch (node.type) {
    case 'identifier':
      return variant && variant !== 'italic' && variant !== 'normal'
        ? inVariant(node.text, variant)
        : node.text
    case 'number':
      return variant === 'bold' || variant === 'double-struck'
        ? inVariant(node.text, variant)
        : node.text
    case 'operator':
      if (node.kind === 'bin' || node.kind === 'rel') return ` ${node.text} `
      if (node.kind === 'punct') return `${node.text} `
      return node.text
    case 'function':
      return `${node.text} `
    case 'text':
      return node.text
    case 'space':
      return node.width >= 0.9 ? '  ' : node.width >= 0.15 ? ' ' : ''
    case 'row': {
      let out = ''
      node.children.forEach((child, at) => {
        let part = line(child, variant)
        // A sign at the start, or after an operator or a bracket, is a sign, not an operation.
        const previous = node.children[at - 1]
        const unary =
          child.type === 'operator' &&
          child.kind === 'bin' &&
          (at === 0 ||
            (previous?.type === 'operator' &&
              ['bin', 'rel', 'open', 'punct', 'op'].includes(previous.kind)))
        if (unary) part = part.trim()
        // A big operator stands apart from what is around it (`1/k ∑ᵢ rᵢ`), a name from the term
        // before it (`n log n`).
        if (takesOperand(child)) part = ` ${part.trim()} `
        else if (isName(child) && previous && endsInTerm(previous)) part = ` ${part}`
        out += part
      })
      return out
    }
    case 'fraction': {
      const top = line(node.numerator, variant).trim()
      const bottom = line(node.denominator, variant).trim()
      return node.rule ? `${grouped(top)}/${grouped(bottom)}` : `${top} ${bottom}`
    }
    case 'root': {
      const body = line(node.body, variant).trim()
      const index = node.index ? scripted(line(node.index, variant), SUPER, '') : ''
      return `${index}√${SIMPLE.test(body) ? body : `(${body})`}`
    }
    case 'scripts': {
      const base = line(node.base, variant)
      const sub = node.sub ? scripted(line(node.sub, variant), SUB, '_') : ''
      const sup = node.sup ? scripted(line(node.sup, variant), SUPER, '^') : ''
      return `${base.trimEnd()}${sub}${sup}${base.endsWith(' ') ? ' ' : ''}`
    }
    case 'accent': {
      const base = line(node.base, variant).trim()
      if (node.char === '⏟' || node.char === '⏞') return base
      // A terminal writes an accent as the combining mark over its letter.
      if (node.char === '‾') return [...base].map((char) => `${char}\u0305`).join('')
      const mark = COMBINING[node.char]
      return [...base].length === 1 && mark ? `${base}${mark}` : base
    }
    case 'stack': {
      const base = line(node.base, variant).trim()
      const over = node.over ? line(node.over, variant).trim() : ''
      return over ? ` ${base}${scripted(over, SUPER, '^')} ` : ` ${base} `
    }
    case 'fenced':
      // A binomial on one line is written as its count: `C(n, k)`.
      if (node.body.type === 'fraction' && !node.body.rule)
        return `C(${line(node.body.numerator, variant).trim()}, ${line(node.body.denominator, variant).trim()})`
      return `${node.open}${line(node.body, variant).trim()}${node.close}`
    case 'table': {
      const rows = node.rows.map((cells) =>
        cells
          .map((cell) => line(cell, variant).trim())
          .join(node.kind === 'aligned' ? ' ' : node.kind === 'cases' ? ' if ' : ', '),
      )
      if (node.kind === 'matrix' || node.kind === 'small')
        return `${node.open || '['}${rows.map((row) => `[${row}]`).join(', ')}${node.close || ']'}`
      if (node.kind === 'cases') return `${node.open}${rows.join('; ')}${node.close}`
      return rows.join('; ')
    }
    case 'variant':
      return line(node.body, node.variant)
    case 'style':
    case 'color':
      return line(node.body, variant)
    case 'boxed':
      return `[${line(node.body, variant).trim()}]`
    case 'phantom':
      return ' '.repeat([...line(node.body, variant)].length)
    case 'error':
      return node.text
  }
}
