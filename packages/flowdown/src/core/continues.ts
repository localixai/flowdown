/**
 * Whether `next` holds what `previous` held from `from` up to `upTo`: the question every part that
 * remembers a growing text asks on each token, before it goes on from where it stopped.
 *
 * It is asked with `===` on two slices, not with `startsWith`. The two say the same, but V8
 * (Chrome, Edge, Node) compares the slices as memory and walks `startsWith` a character at a
 * time: on a 35 KB reply that is one microsecond against seventy, on every token.
 *
 * `upTo` is a place inside `previous`; past its end the answer is no, and the caller starts over.
 */
export const continues = (next: string, previous: string, upTo: number, from = 0): boolean =>
  next.length >= upTo && next.slice(from, upTo) === previous.slice(from, upTo)

/**
 * What a caller has already checked of a text that grew: up to `same`, it reads as `previous`
 * did. A document compares the reply with the last one once a token and hands this down, so each
 * part that remembers the last text does not compare it again.
 */
export interface Grown {
  previous: string
  same: number
}

/**
 * Where a part that remembers `remembered` has to start comparing, from `from` on: past what the
 * caller checked, when the caller checked against the very text the part remembers. A text the
 * part remembers from an earlier update is not `previous`, and is compared as before.
 */
export const checked = (grown: Grown | null | undefined, remembered: string, from = 0): number =>
  grown != null && grown.previous === remembered ? Math.max(from, grown.same) : from
