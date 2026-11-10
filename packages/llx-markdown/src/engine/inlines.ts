/**
 * The inline pass: the text of one block read into emphasis, links, code spans and the rest, by
 * the algorithm in the CommonMark spec (a delimiter stack for emphasis, a bracket stack for
 * links). One pass over the text; the parser's state lives in the module, since a block's text
 * is read from start to end before the next one begins.
 */
import { decodeEntity, ENTITY, isEscapable, normalizeUri, unescapeString } from './entities'
import type { InlineRule, InlineState, Node, Reference } from './types'

export interface InlineContext {
  refs: Map<string, Reference>
  /** The footnotes the document defines: normalized label to the label as written. */
  footnotes: Map<string, string>
  /** How many times each footnote has been referred to so far, in the order first referred to. */
  footnoteUses: Map<string, number>
  gfm: boolean
  /** Whether `$$` alone on a line fences a display formula. */
  math: boolean
  /** Extension rules by the ASCII code of the character that starts them. */
  rules: (InlineRule['parse'][] | undefined)[]
  /** 1 for every ASCII character that can start something other than plain text. */
  special: Uint8Array
}

/** A node while its block is read: linked to its siblings, so emphasis can wrap a run of them. */
interface Inl {
  type: string
  value: string
  parent: Inl | null
  prev: Inl | null
  next: Inl | null
  first: Inl | null
  last: Inl | null
  url: string
  title: string
  /** The finished node of an extension's construct. */
  node: Node | null
}

interface Delimiter {
  cc: number
  num: number
  orig: number
  node: Inl
  prev: Delimiter | null
  next: Delimiter | null
  canOpen: boolean
  canClose: boolean
}

interface Bracket {
  node: Inl
  prev: Bracket | null
  prevDelimiter: Delimiter | null
  index: number
  image: boolean
  active: boolean
  bracketAfter: boolean
}

/** A bare address found in the text: where it is and where it leads. */
interface Span {
  start: number
  end: number
  url: string
}

const C_NEWLINE = 10
const C_SPACE = 32
const C_BANG = 33
const C_AMPERSAND = 38
const C_OPEN_PAREN = 40
const C_CLOSE_PAREN = 41
const C_ASTERISK = 42
const C_COLON = 58
const C_LESSTHAN = 60
const C_OPEN_BRACKET = 91
const C_BACKSLASH = 92
const C_CLOSE_BRACKET = 93
const C_CARET = 94
const C_UNDERSCORE = 95
const C_BACKTICK = 96
const C_TILDE = 126

const TAGNAME = '[A-Za-z][A-Za-z0-9-]*'
const ATTRIBUTENAME = '[a-zA-Z_:][a-zA-Z0-9:._-]*'
const ATTRIBUTEVALUE = '(?:[^"\'=<>`\\x00-\\x20]+|\'[^\']*\'|"[^"]*")'
const ATTRIBUTE = `(?:\\s+${ATTRIBUTENAME}(?:\\s*=\\s*${ATTRIBUTEVALUE})?)`
export const OPENTAG = `<${TAGNAME}${ATTRIBUTE}*\\s*/?>`
export const CLOSETAG = `</${TAGNAME}\\s*[>]`
const HTMLTAG = `(?:${OPENTAG}|${CLOSETAG}|<!-->|<!--->|<!--[\\s\\S]*?-->|[<][?][\\s\\S]*?[?][>]|<![A-Za-z]+[^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`

const reHtmlTag = new RegExp(HTMLTAG, 'y')
const reEntity = new RegExp(ENTITY, 'iy')
// The specification's own character classes name control characters.
// oxlint-disable-next-line no-control-regex
const reAutolink = /<([A-Za-z][A-Za-z0-9.+-]{1,31}:[^<>\x00-\x20]*)>/y
const reEmailAutolink =
  /<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/y
const reLinkLabel = /\[(?:[^\\[\]]|\\[\s\S]){0,1000}\]/y
// oxlint-disable-next-line no-control-regex
const reLinkDestinationBraces = /<(?:[^<>\n\\\x00]|\\.)*>/y
const reLinkTitle = /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^()\\])*\)/y
const reSpaceAtEndOfLine = /[ \t]*(?:\n|$)/y
const reFootnoteReference = /\[\^([^\]\s]+)\]/y
const reUnicodeSpace = /\p{Zs}/u
const reUnicodePunctuation = /[\p{P}\p{S}]/u
/** Bare addresses: a URL with a scheme, one that starts `www.`, or an email address. */
const reBareLink =
  /(?:(?:https?|ftp):\/\/|www\.)[^\s<]*|(mailto:|xmpp:)?[A-Za-z0-9._+-]+@[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+(\/[A-Za-z0-9@.]+)?/g
const reBareLinkHint = /www\.|:\/\/|@/

let subject = ''
let pos = 0
let end = 0
let ctx: InlineContext
let root: Inl
let delimiters: Delimiter | null = null
let brackets: Bracket | null = null
/** Whether the text may hold a bare address (`www.`, `://`, `@`) to turn into a link. */
let bareLinks = false
/** Lengths of backtick runs known to have no closing run in the rest of the text. */
let noBacktickCloser: Set<number> | null = null

const inl = (type: string, value = ''): Inl => ({
  type,
  value,
  parent: null,
  prev: null,
  next: null,
  first: null,
  last: null,
  url: '',
  title: '',
  node: null,
})

const append = (parent: Inl, child: Inl): void => {
  child.parent = parent
  child.prev = parent.last
  child.next = null
  if (parent.last) parent.last.next = child
  else parent.first = child
  parent.last = child
}

const unlink = (node: Inl): void => {
  if (node.prev) node.prev.next = node.next
  else if (node.parent) node.parent.first = node.next
  if (node.next) node.next.prev = node.prev
  else if (node.parent) node.parent.last = node.prev
  node.parent = node.prev = node.next = null
}

const insertAfter = (node: Inl, sibling: Inl): void => {
  sibling.parent = node.parent
  sibling.prev = node
  sibling.next = node.next
  if (node.next) node.next.prev = sibling
  else if (node.parent) node.parent.last = sibling
  node.next = sibling
}

const text = (value: string): Inl => {
  const node = inl('text', value)
  append(root, node)
  return node
}

/** Runs a sticky expression at the current place; the match, with the place moved past it. */
const match = (re: RegExp): string | null => {
  re.lastIndex = pos
  const found = re.exec(subject)
  if (found === null) return null
  pos = re.lastIndex
  return found[0]
}

/** Skips spaces, tabs and at most one line ending. */
const spnl = (): void => {
  let code = subject.charCodeAt(pos)
  while (code === C_SPACE || code === 9) code = subject.charCodeAt(++pos)
  if (code === C_NEWLINE) {
    code = subject.charCodeAt(++pos)
    while (code === C_SPACE || code === 9) code = subject.charCodeAt(++pos)
  }
}

const isWhitespace = (code: number): boolean =>
  code === 32 ||
  code === 10 ||
  code === 9 ||
  code === 13 ||
  code === 12 ||
  (code >= 128 && reUnicodeSpace.test(String.fromCodePoint(code)))

const isPunctuation = (code: number): boolean =>
  code < 128 ? isEscapable(code) : reUnicodePunctuation.test(String.fromCodePoint(code))

const parseNewline = (): void => {
  pos++
  const last = root.last
  if (
    last !== null &&
    last.type === 'text' &&
    last.value.charCodeAt(last.value.length - 1) === 32
  ) {
    const hard = last.value.charCodeAt(last.value.length - 2) === 32
    last.value = last.value.replace(/ +$/, '')
    append(root, inl(hard ? 'break' : 'softbreak'))
  } else append(root, inl('softbreak'))
  while (subject.charCodeAt(pos) === C_SPACE) pos++
}

const parseBackslash = (): void => {
  pos++
  const code = subject.charCodeAt(pos)
  if (code === C_NEWLINE) {
    pos++
    append(root, inl('break'))
    while (subject.charCodeAt(pos) === C_SPACE) pos++
  } else if (isEscapable(code)) {
    text(subject.charAt(pos))
    pos++
  } else text('\\')
}

const parseBackticks = (): void => {
  const start = pos
  while (subject.charCodeAt(pos) === C_BACKTICK) pos++
  const length = pos - start
  const after = pos
  if (noBacktickCloser === null || !noBacktickCloser.has(length)) {
    let from = after
    for (;;) {
      const open = subject.indexOf('`', from)
      if (open === -1) break
      let close = open + 1
      while (subject.charCodeAt(close) === C_BACKTICK) close++
      if (close - open === length) {
        let content = subject.slice(after, open)
        if (content.indexOf('\n') !== -1) content = content.replace(/\n/g, ' ')
        if (
          content.charCodeAt(0) === 32 &&
          content.charCodeAt(content.length - 1) === 32 &&
          /[^ ]/.test(content)
        )
          content = content.slice(1, -1)
        append(root, inl('inlineCode', content))
        pos = close
        return
      }
      from = close
    }
    ;(noBacktickCloser ??= new Set()).add(length)
  }
  pos = after
  text(subject.slice(start, after))
}

const parseDelimiters = (cc: number): void => {
  const start = pos
  while (subject.charCodeAt(pos) === cc) pos++
  const num = pos - start
  // Strikethrough is one tilde or two; a longer run is text.
  if (cc === C_TILDE && num > 2) {
    text(subject.slice(start, pos))
    return
  }
  let before = C_NEWLINE
  if (start > 0) {
    before = subject.charCodeAt(start - 1)
    if (before >= 0xdc00 && before <= 0xdfff && start > 1)
      before = subject.codePointAt(start - 2) ?? before
  }
  const after = pos < end ? (subject.codePointAt(pos) ?? C_NEWLINE) : C_NEWLINE
  const afterIsWhitespace = isWhitespace(after)
  const afterIsPunctuation = isPunctuation(after)
  const beforeIsWhitespace = isWhitespace(before)
  const beforeIsPunctuation = isPunctuation(before)
  const leftFlanking =
    !afterIsWhitespace && (!afterIsPunctuation || beforeIsWhitespace || beforeIsPunctuation)
  const rightFlanking =
    !beforeIsWhitespace && (!beforeIsPunctuation || afterIsWhitespace || afterIsPunctuation)
  const canOpen =
    cc === C_UNDERSCORE ? leftFlanking && (!rightFlanking || beforeIsPunctuation) : leftFlanking
  const canClose =
    cc === C_UNDERSCORE ? rightFlanking && (!leftFlanking || afterIsPunctuation) : rightFlanking
  const node = text(subject.slice(start, pos))
  if (!canOpen && !canClose) return
  const delimiter: Delimiter = {
    cc,
    num,
    orig: num,
    node,
    prev: delimiters,
    next: null,
    canOpen,
    canClose,
  }
  if (delimiters !== null) delimiters.next = delimiter
  delimiters = delimiter
}

const removeDelimiter = (delimiter: Delimiter): void => {
  if (delimiter.prev !== null) delimiter.prev.next = delimiter.next
  if (delimiter.next === null) delimiters = delimiter.prev
  else delimiter.next.prev = delimiter.prev
}

/** Turns matching delimiter runs above `bottom` into emphasis, strong and strikethrough. */
const processEmphasis = (bottom: Delimiter | null): void => {
  // The lowest opener worth looking at, by what kind of closer is asking: `_` and `*` by whether
  // the closer can open and its length modulo three, `~` by its length.
  const bottoms: (Delimiter | null)[] = [
    bottom,
    bottom,
    bottom,
    bottom,
    bottom,
    bottom,
    bottom,
    bottom,
    bottom,
    bottom,
    bottom,
    bottom,
    bottom,
    bottom,
  ]
  let closer = delimiters
  while (closer !== null && closer.prev !== bottom) closer = closer.prev
  while (closer !== null) {
    if (!closer.canClose) {
      closer = closer.next
      continue
    }
    const cc = closer.cc
    const key =
      cc === C_TILDE
        ? 11 + closer.orig
        : (cc === C_UNDERSCORE ? 0 : 6) + (closer.canOpen ? 3 : 0) + (closer.orig % 3)
    let opener = closer.prev
    let found = false
    while (opener !== null && opener !== bottom && opener !== bottoms[key]) {
      if (opener.cc === cc && opener.canOpen) {
        if (cc === C_TILDE) found = opener.orig === closer.orig
        else
          found = !(
            (closer.canOpen || opener.canClose) &&
            closer.orig % 3 !== 0 &&
            (opener.orig + closer.orig) % 3 === 0
          )
        if (found) break
      }
      opener = opener.prev
    }
    const old: Delimiter = closer
    if (found && opener !== null) {
      const use = cc === C_TILDE ? closer.num : closer.num >= 2 && opener.num >= 2 ? 2 : 1
      opener.num -= use
      closer.num -= use
      opener.node.value = opener.node.value.slice(use)
      closer.node.value = closer.node.value.slice(use)
      const wrapper = inl(cc === C_TILDE ? 'delete' : use === 1 ? 'emphasis' : 'strong')
      let between = opener.node.next
      while (between !== null && between !== closer.node) {
        const next: Inl | null = between.next
        unlink(between)
        append(wrapper, between)
        between = next
      }
      insertAfter(opener.node, wrapper)
      // Delimiters between the two can no longer match anything.
      if (opener.next !== closer) {
        opener.next = closer
        closer.prev = opener
      }
      if (opener.num === 0) {
        unlink(opener.node)
        removeDelimiter(opener)
      }
      if (closer.num === 0) {
        unlink(closer.node)
        const next: Delimiter | null = closer.next
        removeDelimiter(closer)
        closer = next
      }
    } else {
      closer = old.next
      bottoms[key] = old.prev
      if (!old.canOpen) removeDelimiter(old)
    }
  }
  // `removeDelimiter` moves `delimiters` down the stack.
  // oxlint-disable-next-line no-unmodified-loop-condition
  while (delimiters !== null && delimiters !== bottom) removeDelimiter(delimiters)
}

const addBracket = (node: Inl, index: number, image: boolean): void => {
  if (brackets !== null) brackets.bracketAfter = true
  brackets = {
    node,
    prev: brackets,
    prevDelimiter: delimiters,
    index,
    image,
    active: true,
    bracketAfter: false,
  }
}

/** A link destination at the current place, or null. */
const parseLinkDestination = (): string | null => {
  const braced = match(reLinkDestinationBraces)
  if (braced !== null) return normalizeUri(unescapeString(braced.slice(1, -1)))
  if (subject.charCodeAt(pos) === C_LESSTHAN) return null
  const start = pos
  let depth = 0
  let code = 0
  while (pos < end) {
    code = subject.charCodeAt(pos)
    if (code === C_BACKSLASH && isEscapable(subject.charCodeAt(pos + 1))) pos += 2
    else if (code === C_OPEN_PAREN) {
      pos++
      depth++
    } else if (code === C_CLOSE_PAREN) {
      if (depth < 1) break
      pos++
      depth--
    } else if (code <= 32 || code === 127) break
    else pos++
  }
  if (pos === start && code !== C_CLOSE_PAREN) return null
  if (depth !== 0) return null
  return normalizeUri(unescapeString(subject.slice(start, pos)))
}

const parseLinkTitle = (): string | null => {
  const title = match(reLinkTitle)
  return title === null ? null : unescapeString(title.slice(1, -1))
}

/** The length of a link label (`[…]`) at the current place, with the place moved past it; or 0. */
const parseLinkLabel = (): number => {
  const label = match(reLinkLabel)
  return label === null || label.length > 1001 ? 0 : label.length
}

/** A reference label as it is matched: without case, with its whitespace collapsed. */
export const normalizeLabel = (label: string): string =>
  label
    .slice(1, -1)
    .trim()
    .replace(/[ \t\r\n]+/g, ' ')
    .toLowerCase()
    .toUpperCase()

const parseCloseBracket = (): void => {
  const start = pos
  pos++
  const opener = brackets
  if (opener === null) {
    text(']')
    return
  }
  if (!opener.active) {
    text(']')
    brackets = opener.prev
    return
  }
  const image = opener.image
  const savepos = pos
  let url = ''
  let title = ''
  let matched = false

  // An inline link: `[text](destination "title")`.
  if (subject.charCodeAt(pos) === C_OPEN_PAREN) {
    pos++
    spnl()
    const destination = parseLinkDestination()
    if (destination !== null) {
      const beforeTitle = pos
      spnl()
      let found: string | null = null
      // A title needs whitespace before it.
      if (pos !== beforeTitle) found = parseLinkTitle()
      spnl()
      if (subject.charCodeAt(pos) === C_CLOSE_PAREN) {
        pos++
        url = destination
        title = found ?? ''
        matched = true
      }
    }
    if (!matched) pos = savepos
  }

  // A reference link: `[text][label]`, `[label][]` or `[label]`.
  if (!matched) {
    const beforeLabel = pos
    const length = parseLinkLabel()
    let label = ''
    if (length > 2) label = subject.slice(beforeLabel, beforeLabel + length)
    else if (!opener.bracketAfter) label = subject.slice(opener.index, start + 1)
    if (length === 0) pos = savepos
    if (label !== '') {
      const reference = ctx.refs.get(normalizeLabel(label))
      if (reference !== undefined) {
        url = reference.url
        title = reference.title
        matched = true
      }
    }
  }

  if (!matched) {
    brackets = opener.prev
    pos = start + 1
    text(']')
    return
  }

  const node = inl(image ? 'image' : 'link')
  node.url = url
  node.title = title
  let inside = opener.node.next
  while (inside !== null) {
    const next: Inl | null = inside.next
    unlink(inside)
    append(node, inside)
    inside = next
  }
  append(root, node)
  processEmphasis(opener.prevDelimiter)
  brackets = opener.prev
  unlink(opener.node)
  if (!image) {
    // A link cannot hold a link: the brackets opened before this one can no longer open any.
    for (let bracket = brackets; bracket !== null; bracket = bracket.prev)
      if (!bracket.image) bracket.active = false
  }
}

const parseOpenBracket = (): void => {
  if (ctx.footnotes.size > 0 && subject.charCodeAt(pos + 1) === C_CARET) {
    reFootnoteReference.lastIndex = pos
    const found = reFootnoteReference.exec(subject)
    const key = found === null ? '' : normalizeLabel(`[${found[1]}]`)
    const label = ctx.footnotes.get(key)
    if (label !== undefined) {
      const uses = (ctx.footnoteUses.get(key) ?? 0) + 1
      ctx.footnoteUses.set(key, uses)
      // A footnote's number is its place among the footnotes referred to so far.
      let index = 0
      for (const used of ctx.footnoteUses.keys()) {
        index++
        if (used === key) break
      }
      state.push({
        type: 'footnoteReference',
        identifier: key.toLowerCase(),
        label,
        index,
        occurrence: uses,
      })
      pos = reFootnoteReference.lastIndex
      return
    }
  }
  const start = pos
  pos++
  addBracket(text('['), start, false)
}

const parseBang = (): void => {
  const start = pos
  pos++
  if (
    subject.charCodeAt(pos) === C_OPEN_BRACKET &&
    // `![^1]` is an exclamation mark and a footnote, not an image.
    !(ctx.footnotes.size > 0 && subject.charCodeAt(pos + 1) === C_CARET)
  ) {
    pos++
    addBracket(text('!['), start + 1, true)
  } else text('!')
}

const parseLessThan = (): void => {
  reEmailAutolink.lastIndex = pos
  let found = reEmailAutolink.exec(subject)
  if (found !== null) {
    const address = found[1] ?? ''
    const node = inl('link')
    node.url = normalizeUri(`mailto:${address}`)
    append(node, inl('text', address))
    append(root, node)
    pos = reEmailAutolink.lastIndex
    return
  }
  reAutolink.lastIndex = pos
  found = reAutolink.exec(subject)
  if (found !== null) {
    const address = found[1] ?? ''
    const node = inl('link')
    node.url = normalizeUri(address)
    append(node, inl('text', address))
    append(root, node)
    pos = reAutolink.lastIndex
    return
  }
  const tag = match(reHtmlTag)
  if (tag !== null) append(root, inl('html', tag))
  else {
    pos++
    text('<')
  }
}

const parseEntity = (): void => {
  reEntity.lastIndex = pos
  const found = reEntity.exec(subject)
  const decoded = found === null ? null : decodeEntity(found[0])
  if (decoded === null) {
    pos++
    text('&')
  } else {
    pos = reEntity.lastIndex
    text(decoded)
  }
}

const isAlphanumeric = (code: number): boolean =>
  (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)

/** Where a bare URL ends, by GitHub's rules for what trails a link without being part of it. */
const trimBareLink = (link: string): string => {
  let length = link.length
  for (;;) {
    const last = link.charCodeAt(length - 1)
    if ('?!.,:*_~\'"'.indexOf(link.charAt(length - 1)) !== -1 && length > 0) length--
    else if (last === C_CLOSE_PAREN) {
      let balance = 0
      for (let index = 0; index < length; index++) {
        const code = link.charCodeAt(index)
        if (code === C_OPEN_PAREN) balance++
        else if (code === C_CLOSE_PAREN) balance--
      }
      if (balance >= 0) break
      length--
    } else if (last === 59 /* ; */) {
      let start = length - 2
      while (start >= 0 && isAlphanumeric(link.charCodeAt(start))) start--
      if (start >= 0 && start < length - 2 && link.charCodeAt(start) === C_AMPERSAND) length = start
      else length--
    } else break
  }
  return link.slice(0, length)
}

/** The bare addresses in a run of text, in order. */
const findBareLinks = (run: string): Span[] => {
  const found: Span[] = []
  reBareLink.lastIndex = 0
  for (let hit = reBareLink.exec(run); hit !== null; hit = reBareLink.exec(run)) {
    let start = hit.index
    let link = hit[0]
    const first = link.charCodeAt(0)
    if (link.indexOf('@') !== -1 && !/^(?:https?:|ftp:|www\.)/.test(link)) {
      let scheme = hit[1] ?? ''
      // `mailto:` and `xmpp:` are part of the link only as a word of their own.
      if (scheme !== '' && start > 0 && isAlphanumeric(run.charCodeAt(start - 1))) {
        start += scheme.length
        link = link.slice(scheme.length)
        scheme = ''
      }
      // Only an XMPP address takes a resource after a slash.
      if (hit[2] !== undefined && scheme !== 'xmpp:') link = link.slice(0, -hit[2].length)
      while (link.charCodeAt(link.length - 1) === 46 /* . */) link = link.slice(0, -1)
      // An address ends in a letter or a digit.
      if (!isAlphanumeric(link.charCodeAt(link.length - 1))) {
        reBareLink.lastIndex = start + link.length
        continue
      }
      found.push({ start, end: start + link.length, url: scheme === '' ? `mailto:${link}` : link })
      reBareLink.lastIndex = start + link.length
      continue
    }
    const www = first === 119 /* w */
    if (start > 0) {
      const before = run.charCodeAt(start - 1)
      // A URL with a scheme starts where its scheme does; `www.` starts a word.
      if (
        www
          ? !isWhitespace(before) &&
            before !== C_ASTERISK &&
            before !== C_UNDERSCORE &&
            before !== C_TILDE &&
            before !== C_OPEN_PAREN
          : (before >= 65 && before <= 90) ||
            (before >= 97 && before <= 122) ||
            before === 60 /* < */
      )
        continue
    }
    const host = www ? 0 : link.indexOf('://') + 3
    let hostEnd = host
    while (hostEnd < link.length) {
      const code = link.charCodeAt(hostEnd)
      if (
        code < 128 &&
        !isAlphanumeric(code) &&
        code !== 45 &&
        code !== 46 &&
        code !== C_UNDERSCORE
      )
        break
      hostEnd++
    }
    const segments = link.slice(host, hostEnd).split('.')
    if (hostEnd === host || (www && (segments.length < 2 || link.length < 5))) continue
    // The last two parts of a domain hold no underscore.
    if (segments.slice(-2).some((segment) => segment.indexOf('_') !== -1)) continue
    link = trimBareLink(link)
    if (link.length <= host) continue
    found.push({ start, end: start + link.length, url: www ? `http://${link}` : link })
    reBareLink.lastIndex = start + link.length
  }
  return found
}

/** The plain text of a run of nodes: what an image's `alt` holds. */
const plainText = (nodes: Node[]): string => {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'image') out += node.alt ?? ''
    else if (node.children) out += plainText(node.children)
    else if (node.type === 'break') out += '\n'
    else out += node.value ?? ''
  }
  return out
}

/** A run of finished nodes with the bare addresses in its text made into links. */
const linkify = (nodes: Node[]): Node[] => {
  let out: Node[] | null = null
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index] as Node
    const value = node.type === 'text' ? (node.value ?? '') : ''
    const found = value !== '' && reBareLinkHint.test(value) ? findBareLinks(value) : null
    if (found === null || found.length === 0) {
      if (out !== null) out.push(node)
      continue
    }
    out ??= nodes.slice(0, index)
    let from = 0
    for (const span of found) {
      if (span.start > from) out.push({ type: 'text', value: value.slice(from, span.start) })
      out.push({
        type: 'link',
        url: normalizeUri(span.url),
        title: '',
        children: [{ type: 'text', value: value.slice(span.start, span.end) }],
      })
      from = span.end
    }
    if (from < value.length) out.push({ type: 'text', value: value.slice(from) })
  }
  return out ?? nodes
}

/**
 * The finished nodes under a parent, with text that ended up side by side joined. `links` is
 * whether bare addresses in the text become links: not inside a link, which cannot hold another.
 */
const finish = (parent: Inl, links: boolean): Node[] => {
  const out: Node[] = []
  let last: Node | undefined
  for (let node = parent.first; node !== null; node = node.next) {
    let made: Node
    switch (node.type) {
      case 'text':
        if (node.value === '') continue
        if (last !== undefined && last.type === 'text') {
          last.value += node.value
          continue
        }
        made = { type: 'text', value: node.value }
        break
      case 'link':
        made = { type: 'link', url: node.url, title: node.title, children: finish(node, false) }
        break
      case 'image': {
        const children = finish(node, false)
        made = { type: 'image', url: node.url, title: node.title, alt: plainText(children) }
        break
      }
      case 'emphasis':
      case 'strong':
      case 'delete':
        made = { type: node.type, children: finish(node, links) }
        break
      case 'softbreak':
        // A line ending inside a paragraph is part of its text, as in mdast.
        if (last !== undefined && last.type === 'text') {
          last.value += '\n'
          continue
        }
        made = { type: 'text', value: '\n' }
        break
      case 'break':
        made = { type: 'break' }
        break
      case 'node':
        if (node.node === null) continue
        made = node.node
        break
      default:
        made = { type: node.type, value: node.value }
    }
    out.push(made)
    last = made
  }
  return links ? linkify(out) : out
}

const state: InlineState = {
  text: '',
  pos: 0,
  push: (node) => {
    const wrapper = inl('node')
    wrapper.node = node
    append(root, wrapper)
  },
}

/** Reads the inline text of one block into nodes. */
export const parseInlines = (source: string, context: InlineContext): Node[] => {
  // The text of a block ends where its last line does: trailing whitespace is not content.
  let length = source.length
  while (length > 0) {
    const code = source.charCodeAt(length - 1)
    if (code !== 32 && code !== 10 && code !== 9) break
    length--
  }
  subject = length === source.length ? source : source.slice(0, length)
  pos = 0
  end = length
  ctx = context
  root = inl('root')
  delimiters = null
  brackets = null
  noBacktickCloser = null
  bareLinks = context.gfm && reBareLinkHint.test(subject)
  const special = context.special
  const rules = context.rules

  while (pos < end) {
    const code = subject.charCodeAt(pos)
    const own = code < 128 ? rules[code] : undefined
    if (own !== undefined) {
      state.text = subject
      state.pos = pos
      let handled = false
      for (const rule of own) {
        if (rule(state)) {
          handled = true
          break
        }
      }
      if (handled) {
        pos = state.pos
        continue
      }
    }
    switch (code) {
      case C_NEWLINE:
        parseNewline()
        break
      case C_BACKSLASH:
        parseBackslash()
        break
      case C_BACKTICK:
        parseBackticks()
        break
      case C_ASTERISK:
      case C_UNDERSCORE:
        parseDelimiters(code)
        break
      case C_TILDE:
        if (context.gfm) parseDelimiters(code)
        else {
          pos++
          text('~')
        }
        break
      case C_OPEN_BRACKET:
        parseOpenBracket()
        break
      case C_BANG:
        parseBang()
        break
      case C_CLOSE_BRACKET:
        parseCloseBracket()
        break
      case C_LESSTHAN:
        parseLessThan()
        break
      case C_AMPERSAND:
        parseEntity()
        break
      default: {
        // A run of plain text, up to the next character that can start something.
        const start = pos
        pos++
        while (pos < end) {
          const next = subject.charCodeAt(pos)
          if (next < 128 && special[next] === 1) break
          pos++
        }
        text(subject.slice(start, pos))
      }
    }
  }
  processEmphasis(null)
  const nodes = finish(root, bareLinks)
  subject = ''
  return nodes
}

/**
 * Reads one link reference definition from the start of a paragraph's text into `refs`. Returns
 * how many characters it took, or 0 when the text does not start with a definition.
 */
export const parseReference = (source: string, refs: Map<string, Reference>): number => {
  subject = source
  pos = 0
  end = source.length
  const labelLength = parseLinkLabel()
  if (labelLength === 0) return 0
  const label = source.slice(0, labelLength)
  if (source.charCodeAt(pos) !== C_COLON) return 0
  pos++
  spnl()
  const destination = parseLinkDestination()
  if (destination === null) return 0
  const beforeTitle = pos
  spnl()
  let title: string | null = null
  if (pos !== beforeTitle) title = parseLinkTitle()
  if (title === null) pos = beforeTitle
  let atLineEnd = match(reSpaceAtEndOfLine) !== null
  if (!atLineEnd && title !== null) {
    // What follows the title is not the end of the line: the definition is the part before it.
    title = null
    pos = beforeTitle
    atLineEnd = match(reSpaceAtEndOfLine) !== null
  }
  if (!atLineEnd) return 0
  const normalized = normalizeLabel(label)
  if (normalized === '') return 0
  if (!refs.has(normalized)) refs.set(normalized, { url: destination, title: title ?? '' })
  return pos
}

/** The characters that start an inline construct, as a table by ASCII code. */
export const specialCharacters = (extra: string): Uint8Array => {
  const table = new Uint8Array(128)
  for (const char of `\n\\\`*_~[]!<&${extra}`) table[char.charCodeAt(0)] = 1
  return table
}
