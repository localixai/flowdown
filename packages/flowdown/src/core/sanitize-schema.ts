/**
 * The dialect's names added to a sanitizer's schema, for a unified pipeline that runs
 * `rehype-sanitize` after the dialect's plugin: without them the sanitizer takes every callout,
 * tab set and step list for content it does not know and strips it.
 *
 *     import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
 *     .use(rehypeSanitize, sanitizeSchemaFor(defaultSchema))
 *
 * Only the dialect's own names pass: `fd-` classes, the forms' data attributes and the two tab
 * elements, with the presentational attributes a README relies on (alignment, image sizes).
 */
type Rule = string | [string, ...Array<string | number | boolean | RegExp | null | undefined>]

interface Schema {
  tagNames?: readonly string[] | null
  attributes?: Readonly<Record<string, readonly Rule[]>> | null
}

const DIALECT_CLASS = /^fd-/

export function sanitizeSchemaFor<S extends Schema>(schema: S): S {
  const defaults = schema.attributes ?? {}
  const lists: Record<string, Rule[]> = {}
  for (const tag of ['ol', 'ul', 'li']) {
    // GitHub's schema names `className` for these three itself (the task-list classes), which
    // overrides the wildcard rule, so the dialect's classes are added to theirs.
    lists[tag] = [
      ...(defaults[tag] ?? []).filter((rule) => !(Array.isArray(rule) && rule[0] === 'className')),
      ['className', 'contains-task-list', 'task-list-item', DIALECT_CLASS],
    ]
  }
  return {
    ...schema,
    tagNames: [
      ...(schema.tagNames ?? []),
      ...'div span picture source aside figure figcaption footer answer-tabs answer-tab'.split(' '),
    ],
    attributes: {
      ...defaults,
      '*': [
        ...(defaults['*'] ?? []),
        'align',
        'width',
        'height',
        ['className', DIALECT_CLASS],
        'dataCallout',
        'dataCalloutTitle',
        'dataVerdict',
        'dataLabel',
        'dataTitle',
      ],
      a: [...(defaults.a ?? []), 'target', 'rel'],
      code: [['className', /^language-./, 'math-inline', 'math-display']],
      img: [...(defaults.img ?? []), 'width', 'height', 'align'],
      source: ['srcSet', 'srcset', 'media', 'type'],
      ...lists,
    },
  }
}
