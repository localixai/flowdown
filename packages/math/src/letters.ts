/**
 * Letters in a typeface as Unicode's mathematical letters: `\mathbb{R}` is ℝ, `\mathbf{x}` is 𝐱.
 * MathML Core draws a typeface only this way (its `mathvariant` knows nothing but `normal`), and a
 * terminal can show these letters where it cannot change its font, so both outputs use this.
 */
import type { Variant } from './tree'

interface Plane {
  upper: number
  lower?: number
  digits?: number
  greekUpper?: number
  greekLower?: number
  /** Letters Unicode had before the block, which the block leaves out. */
  holes?: Record<string, string>
}

const PLANES: Partial<Record<Variant, Plane>> = {
  bold: { upper: 0x1d400, lower: 0x1d41a, digits: 0x1d7ce, greekUpper: 0x1d6a8, greekLower: 0x1d6c2 },
  italic: { upper: 0x1d434, lower: 0x1d44e, greekUpper: 0x1d6e2, greekLower: 0x1d6fc, holes: { h: 'ℎ' } },
  'bold-italic': { upper: 0x1d468, lower: 0x1d482, greekUpper: 0x1d71c, greekLower: 0x1d736 },
  script: {
    upper: 0x1d49c,
    lower: 0x1d4b6,
    holes: { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' },
  },
  'bold-script': { upper: 0x1d4d0, lower: 0x1d4ea },
  fraktur: { upper: 0x1d504, lower: 0x1d51e, holes: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' } },
  'double-struck': {
    upper: 0x1d538,
    lower: 0x1d552,
    digits: 0x1d7d8,
    holes: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' },
  },
  'sans-serif': { upper: 0x1d5a0, lower: 0x1d5ba, digits: 0x1d7e2 },
  'bold-sans-serif': { upper: 0x1d5d4, lower: 0x1d5ee, digits: 0x1d7ec, greekUpper: 0x1d756, greekLower: 0x1d770 },
  monospace: { upper: 0x1d670, lower: 0x1d68a, digits: 0x1d7f6 },
}

/** `text` in `variant`'s letters; a character the typeface has no letter for stays as it is. */
export function inVariant(text: string, variant: Variant): string {
  const plane = PLANES[variant]
  if (!plane) return text
  let out = ''
  for (const char of text) {
    const hole = plane.holes?.[char]
    if (hole) {
      out += hole
      continue
    }
    const code = char.codePointAt(0)!
    let mapped: number | undefined
    if (code >= 0x41 && code <= 0x5a) mapped = plane.upper + code - 0x41
    else if (code >= 0x61 && code <= 0x7a && plane.lower !== undefined) mapped = plane.lower + code - 0x61
    else if (code >= 0x30 && code <= 0x39 && plane.digits !== undefined) mapped = plane.digits + code - 0x30
    else if (code >= 0x391 && code <= 0x3a9 && plane.greekUpper !== undefined) mapped = plane.greekUpper + code - 0x391
    else if (code >= 0x3b1 && code <= 0x3c9 && plane.greekLower !== undefined) mapped = plane.greekLower + code - 0x3b1
    out += mapped === undefined ? char : String.fromCodePoint(mapped)
  }
  return out
}
