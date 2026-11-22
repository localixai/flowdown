/**
 * A formula as MathML Core, which every browser lays out itself: no script runs to place a glyph,
 * and a screen reader reads it as math. What Core leaves out (a typeface, a column's alignment) is
 * written the way Core can say it: Unicode's math letters, and a style on the cell. The TeX it was
 * written in rides along as an annotation, which is what a copy of the formula gives back.
 *
 * It looks the same in every engine with the package's font (`styles.css`): without it, an engine
 * whose system math font cannot grow a bracket draws a matrix's brackets one line tall.
 */
import { inVariant } from './letters'
import { parse } from './parse'
import { endsInTerm, type MathNode, type Variant } from './tree'

export interface MathMLOptions {
  /** A display formula, set on its own line, its limits above and below. */
  display?: boolean
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escape = (text: string): string => text.replace(/[&<>"]/g, (char) => ESCAPES[char]!)
const em = (value: number): string => `${Number(value.toFixed(4))}em`

/** `tex` as a `<math>` element. Reads any text and never throws. */
export function toMathML(tex: string, options: MathMLOptions = {}): string {
  const body = write(parse(tex), null)
  const display = options.display ? ' display="block"' : ''
  const annotation = `<annotation encoding="application/x-tex">${escape(tex.trim())}</annotation>`
  return `<math${display}><semantics>${wrap(body)}${annotation}</semantics></math>`
}

/** Marks drawn by the class that draws them: a border of what they mark, or a brace painted in it. */
const RULED: Record<string, string> = {
  '‾': 'overline',
  _: 'underline',
  '⏞': 'overbrace',
  '⏟': 'underbrace',
  '⏜': 'overbrace',
  '⏝': 'underbrace',
  '⎴': 'overbracket',
  '⎵': 'underbracket',
}

/** One element: a row of several is wrapped in `<mrow>`. */
const wrap = (inside: string): string => (isOne(inside) ? inside : `<mrow>${inside}</mrow>`)

/** Whether `markup` is one element (so it can stand where MathML takes exactly one). */
function isOne(markup: string): boolean {
  if (!markup.startsWith('<')) return false
  const name = /^<([a-z]+)/.exec(markup)?.[1]
  if (!name) return false
  if (markup.endsWith('/>') && markup.indexOf('<', 1) === -1) return true
  // Walk the elements at the top: one closes at the very end.
  let depth = 0
  let at = 0
  while (at < markup.length) {
    const open = markup.indexOf('<', at)
    if (open < 0) break
    const close = markup.indexOf('>', open)
    if (close < 0) return false
    const tag = markup.slice(open, close + 1)
    if (tag.startsWith('</')) depth--
    else if (!tag.endsWith('/>')) depth++
    at = close + 1
    if (depth === 0) return at === markup.length
  }
  return false
}

const one = (node: MathNode, variant: Variant | null): string => wrap(write(node, variant))

function write(node: MathNode, variant: Variant | null): string {
  switch (node.type) {
    case 'identifier':
      return identifier(node.text, node.upright === true, variant)
    case 'number':
      return `<mn>${escape(variant && variant !== 'normal' && variant !== 'italic' ? inVariant(node.text, variant) : node.text)}</mn>`
    case 'operator':
      return operator(node)
    case 'function':
      return functionName(node.text, node.limits, false)
    case 'text': {
      const text = variant ? inVariant(node.text, variant) : node.text
      return `<mtext>${escape(text.replace(/^ | $/g, ' '))}</mtext>`
    }
    case 'space':
      return node.width >= 0
        ? `<mspace width="${em(node.width)}"/>`
        : `<mspace style="margin-left:${em(node.width)}"/>`
    case 'row':
      return writeRow(node.children, variant)
    case 'fraction': {
      const style = node.style ? ` displaystyle="${node.style === 'display'}"` : ''
      const rule = node.rule ? '' : ' linethickness="0"'
      return `<mfrac${style}${rule}>${one(node.numerator, variant)}${one(node.denominator, variant)}</mfrac>`
    }
    case 'root':
      return node.index
        ? `<mroot>${one(node.body, variant)}${one(node.index, variant)}</mroot>`
        : `<msqrt>${write(node.body, variant)}</msqrt>`
    case 'scripts':
      return scripts(node, variant)
    case 'accent': {
      // A line or a brace over or under an expression is a border of its box (`styles.css`): its
      // width is the expression's in every engine, where Chromium places a stretched glyph off it.
      const ruled = RULED[node.char]
      if (ruled) return `<mrow class="ml-${ruled}">${write(node.base, variant)}</mrow>`
      // No room of its own: the mark sits over the middle of what it marks, in every engine.
      const small = node.small ? ' scriptlevel="1"' : ''
      const mark = `<mo stretchy="${node.stretchy}" lspace="0" rspace="0"${small}>${escape(node.char)}</mo>`
      return node.under
        ? `<munder accentunder="true">${one(node.base, variant)}${mark}</munder>`
        : `<mover accent="true">${one(node.base, variant)}${mark}</mover>`
    }
    case 'stack': {
      const base = one(node.base, variant)
      // Words over or under an arrow keep 0.3em clear on each side. The room is spaces, which every
      // engine counts: a relative `mpadded` width is not MathML Core, and Chromium drew long words
      // over the next symbol.
      const pad = (part: MathNode) => {
        const inside = one(part, variant)
        return node.base.type === 'operator' && node.base.stretchy
          ? `<mrow><mspace width="0.3em"/>${inside}<mspace width="0.3em"/></mrow>`
          : inside
      }
      if (node.over && node.under)
        return `<munderover>${base}${pad(node.under)}${pad(node.over)}</munderover>`
      if (node.over) return `<mover>${base}${pad(node.over)}</mover>`
      if (node.under) return `<munder>${base}${pad(node.under)}</munder>`
      return base
    }
    case 'fenced':
      return `<mrow>${fence(node.open, 'prefix')}${write(node.body, variant)}${fence(node.close, 'postfix')}</mrow>`
    case 'table':
      return table(node, variant)
    case 'variant':
      return write(node.body, node.variant)
    case 'style': {
      const attributes =
        node.style === 'script'
          ? 'displaystyle="false" scriptlevel="1"'
          : `displaystyle="${node.style === 'display'}"`
      return `<mrow ${attributes}>${write(node.body, variant)}</mrow>`
    }
    case 'color':
      return `<mrow style="color:${escape(node.color)}">${write(node.body, variant)}</mrow>`
    case 'boxed':
      return `<mrow style="border:0.06em solid;padding:0.2em 0.3em">${write(node.body, variant)}</mrow>`
    case 'phantom':
      return `<mphantom>${write(node.body, variant)}</mphantom>`
    case 'error':
      return `<merror><mtext>${escape(node.text)}</mtext></merror>`
  }
}

function identifier(text: string, upright: boolean, variant: Variant | null): string {
  if (variant && variant !== 'normal') {
    const letters = inVariant(text, variant)
    return `<mi>${escape(letters)}</mi>`
  }
  // One letter leans by default in MathML as in TeX; `normal` stands it up.
  const single = [...text].length === 1
  return single && (upright || variant === 'normal')
    ? `<mi mathvariant="normal">${escape(text)}</mi>`
    : `<mi>${escape(text)}</mi>`
}

function operator(node: Extract<MathNode, { type: 'operator' }>): string {
  const attributes: string[] = []
  const delimiter = node.kind === 'open' || node.kind === 'close' || node.kind === 'fence'
  if (node.size !== undefined)
    attributes.push(
      `minsize="${em(node.size)}"`,
      `maxsize="${em(node.size)}"`,
      'stretchy="true"',
      'symmetric="true"',
    )
  else if (node.stretchy) attributes.push('stretchy="true"')
  // A bracket written without `\left` keeps its size, as in TeX: MathML would grow it.
  else if (delimiter) attributes.push('stretchy="false"')
  // A bar of a norm or a set takes no room of its own, as in TeX (`‖v‖`); a colon is a relation's
  // room apart.
  if (node.kind === 'fence' && node.size === undefined && !node.stretchy)
    attributes.push('lspace="0"', 'rspace="0"')
  if (node.kind === 'rel' && node.text === ':')
    attributes.push('lspace="0.2778em"', 'rspace="0.2778em"')
  if (node.kind === 'op' && node.limits === true) attributes.push('movablelimits="false"')
  // A dot, a slash, a prime or `⋯` among terms takes no room of its own: the operators around it do.
  if (node.kind === 'ord') attributes.push('lspace="0"', 'rspace="0"')
  if (node.kind === 'bin' && node.text === 'mod')
    attributes.push('lspace="0.2222em"', 'rspace="0.2222em"')
  return `<mo${attributes.length ? ` ${attributes.join(' ')}` : ''}>${escape(node.text)}</mo>`
}

/** `\sin`, `\lim`: the name, then a thin space before what it takes (none before a bracket). */
function functionName(text: string, limits: boolean, beforeBracket: boolean): string {
  const after = beforeBracket ? '0' : '0.1667em'
  if (limits)
    return `<mo movablelimits="true" form="prefix" lspace="0" rspace="${after}">${escape(text)}</mo>`
  return `<mi>${escape(text)}</mi><mo lspace="0" rspace="${after}">⁡</mo>`
}

const opensBracket = (node: MathNode | undefined): boolean =>
  node !== undefined &&
  ((node.type === 'operator' && node.kind === 'open') ||
    node.type === 'fenced' ||
    (node.type === 'row' && opensBracket(node.children[0])))

function writeRow(children: MathNode[], variant: Variant | null): string {
  let out = ''
  for (let at = 0; at < children.length; at++) {
    const child = children[at]!
    const next = children[at + 1]
    // A name after a term stands a thin space from it: `n log n`, `y_i log x`.
    const previous = children[at - 1]
    const named =
      child.type === 'function' || (child.type === 'scripts' && child.base.type === 'function')
    if (named && previous && endsInTerm(previous)) out += '<mspace width="0.1667em"/>'
    if (child.type === 'function') {
      out += functionName(child.text, child.limits, opensBracket(next))
      continue
    }
    if (child.type === 'scripts' && child.base.type === 'function' && !child.base.limits) {
      // `\sin^2 x`: the power on the name, then the function's space.
      const name = `<mi>${escape(child.base.text)}</mi>`
      out +=
        scriptsAround(name, child, variant, false) +
        `<mo lspace="0" rspace="${opensBracket(next) ? '0' : '0.1667em'}">⁡</mo>`
      continue
    }
    if (child.type === 'scripts' && child.base.type === 'function') {
      out += scriptsAround(
        functionName(child.base.text, true, opensBracket(next)),
        child,
        variant,
        true,
      )
      continue
    }
    out += write(child, variant)
  }
  return out
}

/** Whether a node's scripts go above and below it (`\sum`, `\lim`, `\underbrace`) or beside it. */
function takesLimits(node: Extract<MathNode, { type: 'scripts' }>): boolean {
  if (node.limits !== undefined) return node.limits
  const base = node.base
  return base.type === 'operator' && base.kind === 'op'
}

function scripts(node: Extract<MathNode, { type: 'scripts' }>, variant: Variant | null): string {
  return scriptsAround(one(node.base, variant), node, variant, takesLimits(node))
}

function scriptsAround(
  base: string,
  node: Extract<MathNode, { type: 'scripts' }>,
  variant: Variant | null,
  limits: boolean,
): string {
  const sub = node.sub && one(node.sub, variant)
  const sup = node.sup && one(node.sup, variant)
  if (limits) {
    if (sub && sup) return `<munderover>${base}${sub}${sup}</munderover>`
    if (sub) return `<munder>${base}${sub}</munder>`
    if (sup) return `<mover>${base}${sup}</mover>`
    return base
  }
  if (sub && sup) return `<msubsup>${base}${sub}${sup}</msubsup>`
  if (sub) return `<msub>${base}${sub}</msub>`
  if (sup) return `<msup>${base}${sup}</msup>`
  return base
}

function fence(char: string, form: 'prefix' | 'postfix'): string {
  if (!char) return ''
  return `<mo fence="true" form="${form}" stretchy="true" symmetric="true">${escape(char)}</mo>`
}

function table(node: Extract<MathNode, { type: 'table' }>, variant: Variant | null): string {
  const rows = node.rows.map((cells) => {
    const tds = cells.map((cell, column) => {
      const align =
        node.align[
          node.kind === 'aligned' ? column % 2 : Math.min(column, node.align.length - 1)
        ] ?? 'center'
      const style = align === 'center' ? '' : ` style="text-align:${align}"`
      const display = node.display ? ' displaystyle="true"' : ''
      let inside = write(cell, variant)
      // `&=`: the relation keeps its room on the left, as it would after a term.
      if (node.kind === 'aligned' && column % 2 === 1 && startsWithRelation(cell))
        inside = `<mi></mi>${inside}`
      return `<mtd${style}${display}>${inside}</mtd>`
    })
    return `<mtr>${tds.join('')}</mtr>`
  })
  const small = node.kind === 'small' ? ' scriptlevel="1"' : ''
  const body = `<mtable class="ml-${node.kind}"${small}>${rows.join('')}</mtable>`
  if (!node.open && !node.close) return body
  return `<mrow>${fence(node.open, 'prefix')}${body}${fence(node.close, 'postfix')}</mrow>`
}

function startsWithRelation(node: MathNode): boolean {
  if (node.type === 'operator') return node.kind === 'rel' || node.kind === 'bin'
  if (node.type === 'row')
    return node.children[0] !== undefined && startsWithRelation(node.children[0])
  if (node.type === 'scripts' || node.type === 'stack') return startsWithRelation(node.base)
  return false
}
