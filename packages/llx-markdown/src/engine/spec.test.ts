import { describe, expect, test } from 'bun:test'
import { cmarkGfm, commonmark, gfm, run, type Example } from '../../test/spec/load'

/** Every example of a suite, one test per section, so a failure names the rule it breaks. */
const suite = (name: string, examples: Example[]) => {
  describe(name, () => {
    const sections = new Map<string, Example[]>()
    for (const example of examples) {
      const list = sections.get(example.section) ?? []
      list.push(example)
      sections.set(example.section, list)
    }
    for (const [section, list] of sections) {
      test(`${section} (${list.length})`, () => {
        for (const example of list) {
          const { html, pass } = run(example)
          if (!pass)
            expect({ example: example.number, html }).toEqual({
              example: example.number,
              html: example.html,
            })
        }
      })
    }
  })
}

suite('CommonMark 0.31.2', commonmark())
suite('GitHub Flavored Markdown: the extensions', gfm())
suite("cmark-gfm's extension tests", cmarkGfm())

test('the suites are whole', () => {
  expect(commonmark().length).toBe(652)
  expect(gfm().length).toBe(22)
  expect(cmarkGfm().length).toBe(30)
})
