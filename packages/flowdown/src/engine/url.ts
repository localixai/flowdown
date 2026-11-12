import type { Node } from './types'

/**
 * Rewrites or refuses a URL: `key` is the attribute it is for (`href`, `src`), `node` the link or
 * image. An empty string leaves the attribute empty.
 */
export type UrlTransform = (url: string, key: string, node: Node) => string | null | undefined

const SAFE_PROTOCOL = /^(?:https?|ircs?|mailto|xmpp)$/i

/**
 * The default for a URL: relative ones and `http`, `https`, `mailto`, `irc`, `ircs` and `xmpp`
 * pass, and everything else (`javascript:`, `data:`, `tel:`) is emptied.
 */
export const defaultUrlTransform = (url: string): string => {
  const colon = url.indexOf(':')
  const question = url.indexOf('?')
  const hash = url.indexOf('#')
  const slash = url.indexOf('/')
  return colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (question !== -1 && colon > question) ||
    (hash !== -1 && colon > hash) ||
    SAFE_PROTOCOL.test(url.slice(0, colon))
    ? url
    : ''
}
