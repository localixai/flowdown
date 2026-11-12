/** Character references (`&amp;`, `&#35;`, `&#x22;`) and backslash escapes, decoded. */
import { ENTITY_CORE } from './entity-core'

/**
 * Named references are in two tables. The names replies use (`&nbsp;`, `&mdash;`, `&rarr;`: the
 * 253 of HTML 4) are in every page. The other 1,900 of HTML5 (`&CounterClockwiseContourIntegral;`)
 * are ten kilobytes almost no document needs: `./entity-table`, added with `addEntities` by
 * whoever loads it (the HTML stage, or `<Markdown>` the first time a document uses such a name).
 */
let named: Map<string, string> | undefined
let whole = false

const read = (table: string, into: Map<string, string>): void => {
  for (const line of table.split('\n')) {
    const tab = line.indexOf('\t')
    into.set(line.slice(0, tab), line.slice(tab + 1))
  }
}

/** A table is one string in the bundle; it becomes a map the first time a name is looked up. */
const namedEntities = (): Map<string, string> => {
  if (named) return named
  read(ENTITY_CORE, (named = new Map()))
  return named
}

/** Adds every HTML5 name (`ENTITY_TABLE` of `./entity-table`) to the ones decoded. */
export const addEntities = (table: string): void => {
  if (whole) return
  whole = true
  read(table, namedEntities())
}

/** Whether every HTML5 name is decoded, not only the common ones. */
export const hasAllEntities = (): boolean => whole

const reNamed = /&([A-Za-z][A-Za-z0-9]{1,31});/g

/** Whether the text holds a named reference that only the whole table knows (or nothing does). */
export const hasRareEntity = (text: string): boolean => {
  if (text.indexOf('&') === -1) return false
  const known = namedEntities()
  reNamed.lastIndex = 0
  for (let match = reNamed.exec(text); match; match = reNamed.exec(text))
    if (!known.has(match[1] as string)) return true
  return false
}

/** The characters of `&name;`, `&#123;` or `&#x7B;` (given whole), or null when it names nothing. */
export const decodeEntity = (entity: string): string | null => {
  if (entity.charCodeAt(1) !== 35 /* # */) return namedEntities().get(entity.slice(1, -1)) ?? null
  const hex = (entity.charCodeAt(2) | 32) === 120 /* x */
  const code = hex ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10)
  if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '�'
  return String.fromCodePoint(code)
}

const ESCAPABLE = '[!"#$%&\'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]'
export const ENTITY = '&(?:#x[a-f0-9]{1,6}|#[0-9]{1,7}|[a-z][a-z0-9]{1,31});'

const reEscapeOrEntity = new RegExp(`\\\\${ESCAPABLE}|${ENTITY}`, 'gi')

/** A string with its backslash escapes and character references resolved. */
export const unescapeString = (text: string): string =>
  text.indexOf('\\') === -1 && text.indexOf('&') === -1
    ? text
    : text.replace(reEscapeOrEntity, (match) =>
        match.charCodeAt(0) === 92 /* \ */ ? match.charAt(1) : (decodeEntity(match) ?? match),
      )

/** Whether a character code is ASCII punctuation, the characters a backslash can escape. */
export const isEscapable = (code: number): boolean =>
  (code >= 33 && code <= 47) ||
  (code >= 58 && code <= 64) ||
  (code >= 91 && code <= 96) ||
  (code >= 123 && code <= 126)

/** Characters a URL may hold as they are; everything else is percent-encoded. */
const URL_SAFE = /[A-Za-z0-9;/?:@&=+$,\-_.!~*'()#]/

/**
 * A link destination as it goes into `href`: percent-encoded, with escapes that are already
 * there kept.
 */
export const normalizeUri = (uri: string): string => {
  let out = ''
  for (let index = 0; index < uri.length; index++) {
    const code = uri.charCodeAt(index)
    if (code === 37 /* % */ && /^[0-9a-f]{2}$/i.test(uri.slice(index + 1, index + 3))) {
      out += uri.slice(index, index + 3)
      index += 2
    } else if (code < 128) {
      const char = uri.charAt(index)
      out += URL_SAFE.test(char) ? char : encodeURIComponent(char)
    } else if (code >= 0xd800 && code <= 0xdfff) {
      const next = uri.charCodeAt(index + 1)
      if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        out += encodeURIComponent(uri.slice(index, index + 2))
        index++
      } else out += '%EF%BF%BD'
    } else out += encodeURIComponent(uri.charAt(index))
  }
  return out
}
