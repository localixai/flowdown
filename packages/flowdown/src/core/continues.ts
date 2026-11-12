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
