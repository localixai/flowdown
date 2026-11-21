/**
 * The commands that stand for one character, by what they are in a formula: a letter, an
 * operator between two terms, a relation, an arrow, a big operator, a delimiter. The class decides
 * the MathML element (`mi`, `mo`) and the room around it, which the browser's operator dictionary
 * gives an `mo` from its character.
 *
 * Written as `name char` pairs in one string per class: a table of objects would cost a page
 * three times the bytes for the same five hundred entries.
 */

export type SymbolClass = 'ord' | 'upright' | 'bin' | 'rel' | 'op' | 'open' | 'close' | 'fence' | 'punct' | 'dots'

export interface MathSymbol {
  char: string
  kind: SymbolClass
  /** A big operator that takes its limits above and below in a display. */
  limits?: boolean
}

const table = (kind: SymbolClass, pairs: string, limits?: boolean): [string, MathSymbol][] =>
  pairs
    .trim()
    .split(/\s+/)
    .reduce<[string, MathSymbol][]>((all, word, at, words) => {
      if (at % 2 === 0) all.push([word, limits === undefined ? { char: words[at + 1]!, kind } : { char: words[at + 1]!, kind, limits }])
      return all
    }, [])

const GREEK_LOWER = `alpha α beta β gamma γ delta δ epsilon ϵ varepsilon ε zeta ζ eta η theta θ vartheta ϑ
iota ι kappa κ varkappa ϰ lambda λ mu μ nu ν xi ξ omicron ο pi π varpi ϖ rho ρ varrho ϱ sigma σ
varsigma ς tau τ upsilon υ phi ϕ varphi φ chi χ psi ψ omega ω digamma ϝ`

// Capitals stand upright, as TeX sets them.
const GREEK_UPPER = `Gamma Γ Delta Δ Theta Θ Lambda Λ Xi Ξ Pi Π Sigma Σ Upsilon Υ Phi Φ Psi Ψ Omega Ω`

const ORD = `infty ∞ partial ∂ nabla ∇ emptyset ∅ varnothing ⌀ forall ∀ exists ∃ nexists ∄ neg ¬ lnot ¬
aleph ℵ beth ℶ hbar ℏ hslash ℏ ell ℓ wp ℘ Re ℜ Im ℑ top ⊤ bot ⊥ angle ∠ measuredangle ∡
triangle △ prime ′ backslash ∖ surd √ flat ♭ natural ♮ sharp ♯ clubsuit ♣ diamondsuit ♢
heartsuit ♡ spadesuit ♠ checkmark ✓ therefore ∴ because ∵ square □ blacksquare ■ Box □ degree °
imath ı jmath ȷ complement ∁ mho ℧ S § P ¶ dag † ddag ‡ copyright © pounds £ eth ð Finv Ⅎ
blacktriangle ▲ lozenge ◊ blacklozenge ⧫ bigstar ★ circledS Ⓢ diagup ╱ diagdown ╲ euro €
yen ¥ textdegree ° partialt ∂ infinity ∞`

const BIN = `pm ± mp ∓ times × div ÷ cdot ⋅ ast ∗ star ⋆ circ ∘ bullet ∙ oplus ⊕ ominus ⊖ otimes ⊗
oslash ⊘ odot ⊙ cup ∪ cap ∩ sqcup ⊔ sqcap ⊓ vee ∨ wedge ∧ lor ∨ land ∧ setminus ∖ smallsetminus ∖
wr ≀ diamond ⋄ bigtriangleup △ bigtriangledown ▽ triangleleft ◃ triangleright ▹ amalg ⨿ uplus ⊎
dotplus ∔ ltimes ⋉ rtimes ⋊ boxplus ⊞ boxminus ⊟ boxtimes ⊠ boxdot ⊡ circledast ⊛ circledcirc ⊚
circleddash ⊝ curlyvee ⋎ curlywedge ⋏ intercal ⊺ barwedge ⌅ veebar ⊻ cdotp ⋅ centerdot ⋅ divideontimes ⋇
And &`

const REL = `leq ≤ le ≤ geq ≥ ge ≥ neq ≠ ne ≠ equiv ≡ approx ≈ approxeq ≊ sim ∼ simeq ≃ cong ≅ propto ∝
subset ⊂ supset ⊃ subseteq ⊆ supseteq ⊇ subsetneq ⊊ supsetneq ⊋ in ∈ notin ∉ ni ∋ owns ∋ mid ∣
parallel ∥ perp ⊥ models ⊨ vdash ⊢ dashv ⊣ vDash ⊨ Vdash ⊩ ll ≪ gg ≫ lll ⋘ ggg ⋙ prec ≺ succ ≻
preceq ⪯ succeq ⪰ doteq ≐ asymp ≍ bowtie ⋈ Join ⋈ sqsubset ⊏ sqsupset ⊐ sqsubseteq ⊑ sqsupseteq ⊒
smile ⌣ frown ⌢ coloneqq ≔ eqqcolon ≕ coloneq ≔ triangleq ≜ lesssim ≲ gtrsim ≳ leqslant ⩽
geqslant ⩾ leqq ≦ geqq ≧ lessgtr ≶ gtrless ≷ nless ≮ ngtr ≯ nleq ≰ ngeq ≱ nsim ≁ ncong ≇ nmid ∤
nparallel ∦ nsubseteq ⊈ nsupseteq ⊉ ni ∋ propto ∝ varpropto ∝ simeq ≃ backsim ∽ thicksim ∼
thickapprox ≈ circeq ≗ eqcirc ≖ bumpeq ≏ Bumpeq ≎ doteqdot ≑ risingdotseq ≓ fallingdotseq ≒
vartriangleleft ⊲ vartriangleright ⊳ trianglelefteq ⊴ trianglerighteq ⊵ lhd ⊲ rhd ⊳ unlhd ⊴ unrhd ⊵
shortmid ∣ shortparallel ∥ between ≬ pitchfork ⋔ multimap ⊸ eqsim ≂ gtrapprox ⪆ lessapprox ⪅
nprec ⊀ nsucc ⊁ precsim ≾ succsim ≿ Subset ⋐ Supset ⋑ approxident ≋ eqdef ≝ questeq ≟ neqq ≠
to → rightarrow → leftarrow ← gets ← leftrightarrow ↔ Rightarrow ⇒ Leftarrow ⇐ Leftrightarrow ⇔
implies ⟹ impliedby ⟸ iff ⟺ mapsto ↦ longmapsto ⟼ longrightarrow ⟶ longleftarrow ⟵
longleftrightarrow ⟷ Longrightarrow ⟹ Longleftarrow ⟸ Longleftrightarrow ⟺ uparrow ↑
downarrow ↓ updownarrow ↕ Uparrow ⇑ Downarrow ⇓ Updownarrow ⇕ nearrow ↗ searrow ↘ swarrow ↙
nwarrow ↖ hookrightarrow ↪ hookleftarrow ↩ rightharpoonup ⇀ rightharpoondown ⇁ leftharpoonup ↼
leftharpoondown ↽ rightleftharpoons ⇌ leftrightharpoons ⇋ leadsto ⇝ rightsquigarrow ⇝
twoheadrightarrow ↠ twoheadleftarrow ↞ rightrightarrows ⇉ leftleftarrows ⇇ rightleftarrows ⇄
leftrightarrows ⇆ upuparrows ⇈ downdownarrows ⇊ curvearrowright ↷ curvearrowleft ↶
circlearrowright ↻ circlearrowleft ↺ looparrowright ↬ looparrowleft ↫ nrightarrow ↛ nleftarrow ↚
nRightarrow ⇏ nLeftarrow ⇍ nleftrightarrow ↮ nLeftrightarrow ⇎ dashrightarrow ⇢ dashleftarrow ⇠
Lsh ↰ Rsh ↱ restriction ↾ upharpoonright ↾ downharpoonright ⇂ Rrightarrow ⇛ Lleftarrow ⇚
leftarrowtail ↢ rightarrowtail ↣ colon :`

// Integrals keep their limits beside them, as TeX sets them; the rest take them above and below.
const OP_LIMITS = `sum ∑ prod ∏ coprod ∐ bigcup ⋃ bigcap ⋂ bigoplus ⨁ bigotimes ⨂ bigodot ⨀ biguplus ⨄
bigsqcup ⨆ bigvee ⋁ bigwedge ⋀`
const OP_SIDE = `int ∫ iint ∬ iiint ∭ iiiint ⨌ oint ∮ oiint ∯ oiiint ∰ intop ∫ smallint ∫`

const OPEN = `lbrace { langle ⟨ lfloor ⌊ lceil ⌈ lvert | lVert ‖ lgroup ⟮ lmoustache ⎰ llbracket ⟦ lparen ( lbrack [`
const CLOSE = `rbrace } rangle ⟩ rfloor ⌋ rceil ⌉ rvert | rVert ‖ rgroup ⟯ rmoustache ⎱ rrbracket ⟧ rparen ) rbrack ]`
const FENCE = `vert | Vert ‖ |`

const DOTS = `dots … ldots … cdots ⋯ vdots ⋮ ddots ⋱ iddots ⋰ dotsb ⋯ dotsc … dotsi ⋯ dotsm ⋯ dotso …`

export const SYMBOLS = new Map<string, MathSymbol>([
  ...table('ord', GREEK_LOWER),
  ...table('upright', GREEK_UPPER),
  ...table('ord', ORD),
  ...table('bin', BIN),
  ...table('rel', REL),
  ...table('op', OP_LIMITS, true),
  ...table('op', OP_SIDE, false),
  ...table('open', OPEN),
  ...table('close', CLOSE),
  ...table('fence', FENCE),
  ...table('dots', DOTS),
])

/** Names set upright as an operator: `\sin x`. Those after `|` take their limits below in a display. */
const FUNCTIONS_TEXT = `arcsin arccos arctan arcsec arccsc arccot sin cos tan cot sec csc sinh cosh tanh coth sech csch
exp log ln lg arg deg dim hom ker tr Tr rank sgn erf | lim liminf limsup max min sup inf det gcd lcm Pr
argmax argmin injlim projlim plim`
const [plain = '', withLimits = ''] = FUNCTIONS_TEXT.split('|')
export const FUNCTIONS = new Map<string, boolean>([
  ...plain.trim().split(/\s+/).map((name): [string, boolean] => [name, false]),
  ...withLimits.trim().split(/\s+/).map((name): [string, boolean] => [name, true]),
])
// How a few of them are written: `\liminf` is "lim inf", `\argmax` is "arg max".
export const FUNCTION_TEXT: Record<string, string> = {
  liminf: 'lim inf',
  limsup: 'lim sup',
  argmax: 'arg max',
  argmin: 'arg min',
  injlim: 'inj lim',
  projlim: 'proj lim',
  plim: 'plim',
}

/** One character a delimiter after `\left`, `\big` and the like may be named by. */
export const DELIMITERS: Record<string, string> = {
  '(': '(', ')': ')', '[': '[', ']': ']', '\\{': '{', '\\}': '}', '|': '|', '\\|': '‖', '/': '/',
  '.': '', '<': '⟨', '>': '⟩', '\\lbrace': '{', '\\rbrace': '}', '\\langle': '⟨', '\\rangle': '⟩',
  '\\lfloor': '⌊', '\\rfloor': '⌋', '\\lceil': '⌈', '\\rceil': '⌉', '\\vert': '|', '\\Vert': '‖',
  '\\lvert': '|', '\\rvert': '|', '\\lVert': '‖', '\\rVert': '‖', '\\uparrow': '↑', '\\downarrow': '↓',
  '\\updownarrow': '↕', '\\Uparrow': '⇑', '\\Downarrow': '⇓', '\\backslash': '∖', '\\lbrack': '[',
  '\\rbrack': ']', '\\lgroup': '⟮', '\\rgroup': '⟯', '\\llbracket': '⟦', '\\rrbracket': '⟧',
}

/** Accents over (and a few under) what they take: the character, and whether it stretches. */
export const ACCENTS: Record<string, { char: string; stretchy: boolean; under?: boolean }> = {
  // Combining marks: the font places them over a letter's own accent point, in every engine; a
  // spacing `^` sits to the left in Chromium and does not grow as `\widehat` needs.
  hat: { char: '\u0302', stretchy: false },
  widehat: { char: '\u0302', stretchy: true },
  check: { char: '\u030c', stretchy: false },
  widecheck: { char: '\u030c', stretchy: true },
  tilde: { char: '\u0303', stretchy: false },
  widetilde: { char: '\u0303', stretchy: true },
  acute: { char: '\u0301', stretchy: false },
  grave: { char: '\u0300', stretchy: false },
  dot: { char: '\u0307', stretchy: false },
  ddot: { char: '\u0308', stretchy: false },
  dddot: { char: '\u20db', stretchy: false },
  breve: { char: '\u0306', stretchy: false },
  bar: { char: '\u0304', stretchy: false },
  mathring: { char: '\u030a', stretchy: false },
  vec: { char: '\u20d7', stretchy: false },
  overrightarrow: { char: '→', stretchy: true },
  overleftarrow: { char: '←', stretchy: true },
  overleftrightarrow: { char: '↔', stretchy: true },
  overline: { char: '‾', stretchy: true },
  underline: { char: '_', stretchy: true, under: true },
  underrightarrow: { char: '→', stretchy: true, under: true },
  underleftarrow: { char: '←', stretchy: true, under: true },
  overbrace: { char: '⏞', stretchy: true },
  underbrace: { char: '⏟', stretchy: true, under: true },
  overparen: { char: '⏜', stretchy: true },
  underparen: { char: '⏝', stretchy: true, under: true },
  overbracket: { char: '⎴', stretchy: true },
  underbracket: { char: '⎵', stretchy: true, under: true },
}

/** Room a command leaves, in em. */
export const SPACES: Record<string, number> = {
  ',': 3 / 18, thinspace: 3 / 18, ':': 4 / 18, '>': 4 / 18, medspace: 4 / 18, ';': 5 / 18,
  thickspace: 5 / 18, '!': -3 / 18, negthinspace: -3 / 18, negmedspace: -4 / 18,
  negthickspace: -5 / 18, quad: 1, qquad: 2, enspace: 0.5, ' ': 0.25, '~': 0.25, nobreakspace: 0.25,
}
