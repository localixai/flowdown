import { describe, expect, test } from 'bun:test'
import { sanitizeSchemaFor } from './sanitize-schema'

const github = {
  tagNames: ['p', 'a', 'ul', 'li', 'img'],
  attributes: {
    '*': ['title'],
    a: ['href'],
    img: ['src'],
    ul: [['className', 'contains-task-list'] as [string, string]],
    li: [['className', 'task-list-item'] as [string, string], 'value'],
  },
  strip: ['script'],
}

describe('sanitizeSchemaFor', () => {
  const schema = sanitizeSchemaFor(github)

  test('keeps what the schema allowed and adds the dialect’s elements', () => {
    expect(schema.strip).toEqual(['script'])
    for (const tag of ['p', 'a', 'div', 'span', 'figure', 'answer-tabs', 'answer-tab'])
      expect(schema.tagNames).toContain(tag)
    expect(schema.attributes.a).toEqual(['href', 'target', 'rel'])
    expect(schema.attributes.img).toEqual(['src', 'width', 'height', 'align'])
    expect(schema.attributes['*']).toContain('title')
    expect(schema.attributes['*']).toContain('dataCallout')
  })

  test('lets only the dialect’s own classes through', () => {
    const rule = schema.attributes['*'].find(
      (entry) => Array.isArray(entry) && entry[0] === 'className',
    ) as unknown as [string, RegExp]
    expect(rule[1].test('fd-callout')).toBe(true)
    expect(rule[1].test('evil fd-callout')).toBe(false)
    expect(rule[1].test('admin-panel')).toBe(false)
  })

  test('list elements keep the task-list classes beside the dialect’s', () => {
    for (const tag of ['ul', 'ol', 'li'] as const) {
      const rules = (schema.attributes as Record<string, unknown[]>)[tag]!
      const classes = rules.filter((entry) => Array.isArray(entry) && entry[0] === 'className')
      expect(classes).toHaveLength(1)
      expect(classes[0]).toContain('contains-task-list')
      expect(classes[0]).toContain('task-list-item')
    }
    // What the schema listed for the element beside its classes is still there.
    expect((schema.attributes as Record<string, unknown[]>).li).toContain('value')
  })

  test('the schema it was given is not changed', () => {
    expect(github.tagNames).toEqual(['p', 'a', 'ul', 'li', 'img'])
    expect(github.attributes.a).toEqual(['href'])
  })

  test('a schema with nothing in it gets the dialect’s names alone', () => {
    const empty: { tagNames?: string[]; attributes?: Record<string, string[]> } = {}
    const bare = sanitizeSchemaFor(empty)
    expect(bare.tagNames).toContain('answer-tabs')
    expect(bare.attributes?.a).toEqual(['target', 'rel'])
  })
})
