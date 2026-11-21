import { describe, expect, test } from 'bun:test'
import { CORPUS } from '../scripts/corpus'
import { seeded } from '../test/random'
import { toSVG } from './index'

/** The elements of `svg`, checked to nest: each closes in the order it opened. */
function balanced(svg: string): boolean {
  const open: string[] = []
  for (const [, slash, name, self] of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    if (self) continue
    if (slash) {
      if (open.pop() !== name) return false
    } else open.push(name!)
  }
  return open.length === 0
}

describe('toSVG', () => {
  test.each(CORPUS.map(([name, source]) => [name, source]))('draws %s', (_, source) => {
    const svg = toSVG(source)
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(balanced(svg!)).toBe(true)
  })

  test('says null for a source that is not a diagram it reads', () => {
    expect(toSVG('not a diagram')).toBeNull()
    expect(toSVG('')).toBeNull()
  })

  test('turns the drawing into shapes: borders and edges are paths, heads are triangles', () => {
    const svg = toSVG('flowchart LR\n  A --> B')!
    expect(svg).toContain('<path d="M')
    expect(svg).toContain('<polygon points=')
    expect(svg).toMatch(/<text [^>]*>A<\/text>/)
    // No box-drawing character is left as a letter.
    expect(svg).not.toMatch(/>[^<]*[─│┌┐└┘╭╮╯╰▶▼]/)
  })

  test('draws a pie as a ring of its slices, with a legend', () => {
    const svg = toSVG('pie title Pets\n "Dogs" : 3\n "Cats" : 1')!
    // A band of the ring for each slice: out along the rim, back along the hole.
    expect(svg.match(/<path d="M[^"]*A92 92 [^"]*A57/g)).toHaveLength(2)
    expect(svg).toContain('75.0%')
    expect(svg).toContain('Dogs')
    expect(toSVG('pie\n "All" : 5')).toContain('fill-rule="evenodd"')
  })

  test('names the diagram for a screen reader', () => {
    const svg = toSVG('flowchart TD\n A --> B', { title: 'Steps' })!
    expect(svg).toContain(' role="img" aria-label="Steps"')
    expect(svg).toContain('><title>Steps</title>')
    // No element names an attribute twice: XML refuses a document that does.
    for (const [element] of svg.matchAll(/<[a-z]+ [^>]*>/g)) {
      const names = [...element.matchAll(/ ([a-z-]+)=/g)].map((hit) => hit[1])
      expect(new Set(names).size).toBe(names.length)
    }
  })

  test('writes what a model wrote as text, never as markup', () => {
    const svg = toSVG(
      'flowchart TD\n A["<img src=x onerror=alert(1)>"] --> B["</svg><script>alert(1)</script>"]',
    )!
    expect(svg).not.toContain('<img')
    expect(svg).not.toContain('<script')
    expect(svg).not.toMatch(/\son[a-z]+=/)
    expect(svg).not.toContain('href')
    expect(balanced(svg)).toBe(true)
  })

  test('reads every prefix of every diagram without throwing, into SVG that nests', () => {
    for (const [, source] of CORPUS) {
      for (let at = 0; at <= source.length; at += 4) {
        const svg = toSVG(source.slice(0, at))
        if (svg !== null && !balanced(svg))
          throw new Error(`unbalanced at ${at}: ${source.slice(0, at)}`)
      }
    }
  })

  test('reads any text', () => {
    const random = seeded(11)
    const words = [
      'flowchart TD',
      'sequenceDiagram',
      'pie',
      '-->',
      '[',
      ']',
      '{',
      '}',
      '(',
      ')',
      'A',
      'B',
      '\n',
      ':',
      '"',
      '|',
      'subgraph',
      'end',
      '%%',
      '->>',
      '--o',
      'classDiagram',
      '<|--',
    ]
    for (let round = 0; round < 300; round++) {
      let source = ''
      for (let length = random.int(0, 30); length > 0; length--) source += `${random.pick(words)} `
      const svg = toSVG(source)
      if (svg !== null) expect(balanced(svg)).toBe(true)
    }
  })
})
