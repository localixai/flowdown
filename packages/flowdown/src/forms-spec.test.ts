/**
 * The dialect's shared cases (`spec/forms/spec.txt`): every one reads into the forms it lists, the
 * same cases and the same printing the Rust crate's tests hold it to, and the markers this package
 * reads are the table's.
 */
import { describe, expect, test } from 'bun:test'
import { forms } from '../test/forms'
import { formMarkers, forms as cases } from '../test/spec/load'
import { flowdownForms } from './core/remark-answer-blocks'
import { CALLOUT_KINDS, CONTAINER_KINDS } from './dialect'
import { parse } from './engine'

describe('the forms of spec/forms/spec.txt', () => {
  test("the markers read are the specification's", () => {
    const read = [
      ...CALLOUT_KINDS.map((kind) => [kind.toUpperCase(), 'callout']),
      ...CONTAINER_KINDS.map((kind) => [kind.toUpperCase(), kind]),
    ]
    expect(read).toEqual(formMarkers())
  })

  for (const example of cases())
    test(`${example.number} ${example.section}`, () => {
      expect(forms(parse(example.markdown, { extensions: [flowdownForms] }))).toBe(example.html)
    })
})
