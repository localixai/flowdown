/**
 * The dialect's forms as HTML: the element each becomes and the class the stylesheet draws it by,
 * in the two fields remark and the engine's renderer both read (`hName`, `hProperties`).
 */
import type { FormName, Lowering } from './forms'

/** The element a form becomes; a form not here keeps the element its node already is. */
const TAGS: Partial<Record<FormName, string>> = {
  'quote-source': 'footer',
  figure: 'figure',
  caption: 'figcaption',
  'section-number': 'span',
  form: 'div',
  'step-head': 'div',
  'step-title': 'span',
  'step-meta': 'span',
  'step-body': 'div',
  stat: 'div',
  'stat-value': 'span',
  'stat-label': 'span',
  source: 'div',
  'source-title': 'span',
  'source-host': 'span',
  'source-note': 'span',
  tabs: 'answer-tabs',
  tab: 'answer-tab',
  verdict: 'aside',
  verdicts: 'div',
  details: 'details',
  summary: 'summary',
}

/** Forms that are told apart by their element or an attribute, not by a class. */
const UNCLASSED = new Set<FormName>(['callout', 'code', 'caption', 'tabs', 'tab', 'summary'])

export const lowerToHtml: Lowering = (form, data) => {
  const name = form.form
  if (name === 'callout')
    return {
      hProperties: {
        dataCallout: form.kind,
        ...(form.title ? { dataCalloutTitle: form.title } : {}),
      },
    }
  // A fence's file rides on its <code>, beside what a stage before this one put there.
  if (name === 'code')
    return {
      hProperties: { ...(data?.hProperties as Record<string, unknown>), dataTitle: form.title },
    }
  const tag = TAGS[name]
  const properties: Record<string, unknown> = {}
  if (!UNCLASSED.has(name)) properties.className = [`fd-${name}`]
  if (name === 'tab') properties.dataLabel = form.label
  if (name === 'verdict') properties.dataVerdict = form.kind
  let has = false
  for (const _ in properties) {
    has = true
    break
  }
  return {
    ...(tag === undefined ? null : { hName: tag }),
    ...(has ? { hProperties: properties } : null),
  }
}
