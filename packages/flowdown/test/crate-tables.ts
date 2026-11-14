/**
 * The Rust crate's two tables, as this package makes them (`scripts/crate-tables.ts`), so both
 * parsers read the same: the named character references from the `character-entities` package
 * this package's own tables come from, and the code points CommonMark calls punctuation as the
 * runtime's `\p{P}` and `\p{S}` say, the very test `engine/inlines.ts` makes. Test and script only.
 */
import { characterEntities } from 'character-entities'

/** Where the crate keeps them. */
export const CRATE_ENTITIES = new URL('../../../crates/flowdown/data/entities.txt', import.meta.url)
export const CRATE_PUNCTUATION = new URL('../../../crates/flowdown/data/punct.bin', import.meta.url)

/**
 * Every HTML5 reference, a line each, sorted by name bytewise: the name, then the code points it
 * stands for, in hex.
 */
export function crateEntities(): string {
  const names = Object.keys(characterEntities).toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return names
    .map((name) => {
      const points = [...(characterEntities[name] ?? '')].map((char) =>
        (char.codePointAt(0) ?? 0).toString(16).toUpperCase(),
      )
      return `${name} ${points.join(' ')}\n`
    })
    .join('')
}

/** The punctuation past ASCII as ranges: first and last, three bytes each, big-endian, sorted. */
export function cratePunctuation(): Uint8Array<ArrayBuffer> {
  const punctuation = /^[\p{P}\p{S}]$/u
  const ranges: [number, number][] = []
  let start = -1
  for (let point = 0x80; point <= 0x110000; point++) {
    const surrogate = point >= 0xd800 && point <= 0xdfff
    const inside = point < 0x110000 && !surrogate && punctuation.test(String.fromCodePoint(point))
    if (inside && start < 0) start = point
    if (!inside && start >= 0) {
      ranges.push([start, point - 1])
      start = -1
    }
  }
  const bytes = new Uint8Array(ranges.length * 6)
  const view = new DataView(bytes.buffer)
  ranges.forEach(([first, last], at) => {
    view.setUint8(at * 6, first >> 16)
    view.setUint16(at * 6 + 1, first & 0xffff)
    view.setUint8(at * 6 + 3, last >> 16)
    view.setUint16(at * 6 + 4, last & 0xffff)
  })
  return bytes
}
