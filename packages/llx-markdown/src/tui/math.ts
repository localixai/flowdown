/**
 * A formula as a terminal can write it: its LaTeX read into Unicode.
 *
 * A terminal has one size of letter on one line, so a formula is not typeset; it is written the
 * way one is typed in plain text: `\frac{1}{k} \sum_{i=1}^{k} r_i` is `1/k ∑ᵢ₌₁ᵏ rᵢ`. A command
 * with a symbol becomes the symbol, a fraction a slash, a script the small letters Unicode has
 * (`x^2` is `x²`) or, where it has none, the script as written (`e^(iπ)`). A command this does
 * not know stays as it was written: a formula is never shorter than what it says.
 *
 * It reads any text and never throws: a reply is not obliged to hold LaTeX that is right.
 */

/** Pairs of a command's name and what it is written as. */
const NAMED = `alpha α beta β gamma γ delta δ epsilon ϵ varepsilon ε zeta ζ eta η theta θ vartheta ϑ
iota ι kappa κ lambda λ mu μ nu ν xi ξ pi π varpi ϖ rho ρ varrho ϱ sigma σ varsigma ς tau τ
upsilon υ phi ϕ varphi φ chi χ psi ψ omega ω Gamma Γ Delta Δ Theta Θ Lambda Λ Xi Ξ Pi Π Sigma Σ
Upsilon Υ Phi Φ Psi Ψ Omega Ω sum ∑ prod ∏ coprod ∐ int ∫ iint ∬ iiint ∭ oint ∮ infty ∞
partial ∂ nabla ∇ times × cdot · div ÷ pm ± mp ∓ le ≤ leq ≤ ge ≥ geq ≥ ne ≠ neq ≠ ll ≪ gg ≫
approx ≈ equiv ≡ sim ∼ simeq ≃ cong ≅ propto ∝ to → rightarrow → gets ← leftarrow ←
leftrightarrow ↔ Rightarrow ⇒ Leftarrow ⇐ Leftrightarrow ⇔ implies ⇒ iff ⇔ mapsto ↦ uparrow ↑
downarrow ↓ in ∈ notin ∉ ni ∋ subset ⊂ subseteq ⊆ supset ⊃ supseteq ⊇ cup ∪ cap ∩ setminus ∖
emptyset ∅ varnothing ∅ forall ∀ exists ∃ nexists ∄ neg ¬ lnot ¬ land ∧ wedge ∧ lor ∨ vee ∨
oplus ⊕ otimes ⊗ odot ⊙ cdots ⋯ ldots … dots … vdots ⋮ ddots ⋱ angle ∠ perp ⊥ parallel ∥ mid ∣
circ ∘ bullet • star ⋆ ast ∗ dagger † langle ⟨ rangle ⟩ lfloor ⌊ rfloor ⌋ lceil ⌈ rceil ⌉
lvert | rvert | vert | lVert ‖ rVert ‖ Vert ‖ ell ℓ hbar ℏ Re ℜ Im ℑ aleph ℵ prime ′ degree °
top ⊤ bot ⊥ vdash ⊢ models ⊨ therefore ∴ because ∵ triangle △ square □ checkmark ✓ lbrace {
rbrace } colon :`

const SYMBOLS = new Map<string, string>()
{
  const words = NAMED.split(/\s+/)
  for (let at = 0; at + 1 < words.length; at += 2) SYMBOLS.set(words[at]!, words[at + 1]!)
}

/** Names that are written upright, as themselves. */
const FUNCTIONS = new Set(
  'sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh log ln lg exp lim limsup liminf max min sup inf det dim ker gcd deg arg Pr hom mod bmod'.split(
    ' ',
  ),
)

/** A mark over or under a letter, as the combining character that draws it. */
const ACCENTS: Record<string, number> = {
  bar: 0x304,
  overline: 0x305,
  hat: 0x302,
  widehat: 0x302,
  tilde: 0x303,
  widetilde: 0x303,
  vec: 0x20d7,
  overrightarrow: 0x20d7,
  dot: 0x307,
  ddot: 0x308,
  underline: 0x332,
}

/** Commands that change how their argument looks and not what it says. */
const TRANSPARENT = new Set(
  'text textrm textit textbf textsf texttt mathrm mathit mathbf mathsf mathtt mathcal mathfrak mathscr boldsymbol bm mbox operatorname boxed underbrace overbrace substack'.split(
    ' ',
  ),
)

/** Commands about size and placement, which a terminal has one of. */
const DROPPED = new Set(
  'left right big Big bigg Bigg bigl bigr Bigl Bigr biggl biggr middle displaystyle textstyle scriptstyle limits nolimits nonumber notag'.split(
    ' ',
  ),
)

/** Pairs of a character and its small form, as a table. */
const small = (pairs: string): Map<string, string> => {
  const chars = [...pairs]
  const table = new Map<string, string>()
  for (let at = 0; at + 1 < chars.length; at += 2) table.set(chars[at]!, chars[at + 1]!)
  return table
}

const SUPER = small(
  '0⁰1¹2²3³4⁴5⁵6⁶7⁷8⁸9⁹+⁺-⁻−⁻=⁼(⁽)⁾aᵃbᵇcᶜdᵈeᵉfᶠgᵍhʰiⁱjʲkᵏlˡmᵐnⁿoᵒpᵖrʳsˢtᵗuᵘvᵛwʷxˣyʸzᶻAᴬBᴮDᴰEᴱGᴳHᴴIᴵJᴶKᴷLᴸMᴹNᴺOᴼPᴾRᴿTᵀUᵁVⱽWᵂ∘°′′',
)
const SUB = small('0₀1₁2₂3₃4₄5₅6₆7₇8₈9₉+₊-₋−₋=₌(₍)₎aₐeₑhₕiᵢjⱼkₖlₗmₘnₙoₒpₚrᵣsₛtₜuᵤvᵥxₓβᵦγᵧρᵨφᵩχᵪ')

/** The sets of numbers, the letters `\mathbb` is asked for that every font has. */
const DOUBLE = small('CℂHℍNℕPℙQℚRℝZℤ')

/** A script in the small letters of `table`; where one is missing, as written after `mark`. */
function script(text: string, table: Map<string, string>, mark: string): string {
  const body = text.replace(/\s+/g, ' ').trim()
  if (body === '') return ''
  let out = ''
  for (const char of body) {
    if (char === ' ') continue
    const to = table.get(char)
    if (to === undefined) return mark + ([...body].length === 1 ? body : `(${body})`)
    out += to
  }
  return out
}

/**
 * What needs no brackets to stand over or under a slash: a word (letters, digits, their marks),
 * with a root or a `∂` before it and one bracketed group after it, as in `√π`, `∂x`, `P(B)`.
 */
const WORD = /^[√∂∇]?[\p{L}\p{N}\p{M}.′']*(?:\([^()]*\))?$/u
const MARK = /\p{M}/u

/** `text` as one thing: itself when it is a word, bracketed when it is more. */
const atom = (text: string): string => {
  const body = text.trim().replace(/^([∂∇]) +/, '$1')
  return WORD.test(body) ? body : `(${body})`
}

function accented(text: string, code: number): string {
  const mark = String.fromCharCode(code)
  let out = ''
  for (const char of text.trim()) out += char === ' ' || MARK.test(char) ? char : char + mark
  return out
}

/** Groups and arguments nested deeper than this are read as text: no formula is, and no stack is that deep. */
const MAX_DEPTH = 16

const LETTERS = /[a-zA-Z]+/y

class Reader {
  private at = 0
  private depth = 0
  /** The environments this is inside, innermost last. */
  private readonly inside: string[] = []

  constructor(private readonly text: string) {}

  /** Everything up to the end, or inside a group up to the `}` that closes it. */
  run(grouped = false): string {
    let out = ''
    while (this.at < this.text.length) {
      if (grouped && this.text[this.at] === '}') break
      out += this.piece()
    }
    return out
  }

  /** The next thing, with what it takes. Always moves on. */
  private piece(): string {
    const char = String.fromCodePoint(this.text.codePointAt(this.at)!)
    this.at += char.length
    switch (char) {
      case '\\':
        return this.command()
      case '{':
        return this.group()
      case '^':
        return script(this.argument(), SUPER, '^')
      case '_':
        return script(this.argument(), SUB, '_')
      // A column: of cases, the condition after its value; of an alignment, nothing to write.
      case '&':
        return this.inside.at(-1) === 'cases' ? ', ' : ''
      case '~':
        return ' '
      default:
        // A line ending of the source is a space: only `\\` ends a row.
        return char === '\n' || char === '\r' || char === '\t' ? ' ' : char
    }
  }

  /** The group whose `{` was just read. */
  private group(): string {
    if (this.depth >= MAX_DEPTH) return '{'
    this.depth++
    const inside = this.run(true)
    this.depth--
    if (this.text[this.at] === '}') this.at++
    return inside
  }

  /** What a command or a script takes: a group, or the one thing that comes next. */
  private argument(): string {
    while (this.text[this.at] === ' ') this.at++
    const next = this.text[this.at]
    if (next === undefined || next === '}' || this.depth >= MAX_DEPTH) return ''
    if (next === '{') {
      this.at++
      return this.group()
    }
    this.depth++
    const one = this.piece()
    this.depth--
    return one
  }

  /** The `[n]` of a root, when it has one. */
  private index(): string {
    if (this.text[this.at] !== '[' || this.depth >= MAX_DEPTH) return ''
    this.at++
    this.depth++
    let out = ''
    while (this.at < this.text.length && this.text[this.at] !== ']' && this.text[this.at] !== '}')
      out += this.piece()
    this.depth--
    if (this.text[this.at] === ']') this.at++
    return out
  }

  /** The `{name}` of an environment, read past. */
  private name(): string {
    if (this.text[this.at] !== '{') return ''
    const from = this.at + 1
    const close = this.text.indexOf('}', from)
    this.at = close === -1 ? this.text.length : close + 1
    return this.text.slice(from, close === -1 ? undefined : close).trim()
  }

  /** The command whose backslash was just read. */
  private command(): string {
    LETTERS.lastIndex = this.at
    const name = LETTERS.exec(this.text)?.[0]
    if (name === undefined) return this.escaped()
    this.at += name.length
    const symbol = SYMBOLS.get(name)
    if (symbol !== undefined) return symbol
    if (FUNCTIONS.has(name)) return name
    const accent = ACCENTS[name]
    if (accent !== undefined) return accented(this.argument(), accent)
    if (TRANSPARENT.has(name)) return this.argument()
    if (DROPPED.has(name)) {
      // `\left.` and `\right.` are the side of a pair that is not drawn.
      if ((name === 'left' || name === 'right') && this.text[this.at] === '.') this.at++
      return ''
    }
    switch (name) {
      case 'frac':
      case 'dfrac':
      case 'tfrac':
      case 'cfrac': {
        const over = atom(this.argument())
        return `${over}/${atom(this.argument())}`
      }
      case 'binom':
      case 'dbinom':
      case 'tbinom': {
        const from = this.argument().trim()
        return `C(${from}, ${this.argument().trim()})`
      }
      case 'sqrt': {
        const index = this.index()
        return `${script(index, SUPER, '')}√${atom(this.argument())}`
      }
      case 'mathbb':
        return [...this.argument()].map((char) => DOUBLE.get(char) ?? char).join('')
      case 'not':
        return `${this.argument()}̸`
      case 'tag':
        return `(${this.argument().trim()})`
      case 'pmod':
        return ` (mod ${this.argument().trim()})`
      case 'begin': {
        const environment = this.name()
        this.inside.push(environment)
        return environment === 'cases' ? ' { ' : ' '
      }
      case 'end':
        this.name()
        this.inside.pop()
        return ' '
      case 'quad':
      case 'qquad':
        return ' '
    }
    // Not known: as it was written, with what it took.
    let out = `\\${name}`
    while (this.text[this.at] === '{' && this.depth < MAX_DEPTH) {
      this.at++
      out += `{${this.group()}}`
    }
    return out
  }

  /** A backslash before something that is not a letter. */
  private escaped(): string {
    const char = this.text[this.at]
    if (char === undefined) return '\\'
    this.at++
    // `\\` ends a row of the formula.
    if (char === '\\') return '\n'
    if (char === ',' || char === ';' || char === ':' || char === ' ') return ' '
    if (char === '!') return ''
    if (char === '|') return '‖'
    if ('{}%$&_#'.includes(char)) return char
    return `\\${char}`
  }
}

/** A row with its spaces as a reader writes them: one between things, none inside a bracket. */
const tidy = (row: string): string =>
  row
    .replace(/\s+/g, ' ')
    .replace(/([([⟨⌊⌈]) /g, '$1')
    .replace(/ ([)\]⟩⌋⌉,])/g, '$1')
    .trim()
    // A letter with its mark as one character where there is one: fonts draw `ŷ` better than `y` and a hat.
    .normalize('NFC')

/** The rows of a formula: one, unless the formula breaks its own (`\\`). */
export function mathRows(source: string): string[] {
  return new Reader(source).run().split('\n').map(tidy).filter(Boolean)
}

/** A formula on one row, as it is written inside a sentence. */
export const mathText = (source: string): string => mathRows(source).join(' ')
