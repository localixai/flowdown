'use client'
/**
 * Pacing a reply that arrives in bursts.
 *
 * A model's text reaches the page in uneven pieces: a network frame holds one word or forty, a
 * cache hit holds the whole reply. Drawn as it lands, the page jumps by a line at a time and then
 * stands still. This shows the text at an even pace instead, a few frames behind what has arrived:
 *
 *   - the speed follows the backlog (what has arrived and is not shown yet is shown over about
 *     `catchUp` ms) and changes gradually, so a burst speeds the flow up instead of landing whole;
 *   - text is shown a word at a time: a word typed letter by letter at the end of a line grows
 *     there and then jumps to the next line when it no longer fits, and a whole word never does;
 *   - when the reply ends, what is left is shown at the same pace instead of landing at once;
 *   - text that was there before streaming began is shown at once: only growth is paced;
 *   - with `prefers-reduced-motion`, nothing is paced.
 *
 * It never shows text that has not arrived, and costs nothing once it has caught up: the frame
 * loop runs only while there is a backlog.
 */
import { useEffect, useState } from 'react'
import { continues } from '../core/continues'

/** How long a backlog takes to show, by default. */
export const DEFAULT_CATCH_UP_MS = 240
/** The least time between two steps: about 30 a second, each of which is drawn. */
const STEP_MS = 30
/** How fast the speed itself follows the backlog. */
const EASE_MS = 140
/** A reply that has not grown for this long is between words, not inside one. */
const PAUSE_MS = 160
/** A word longer than this (a URL, a hash) is shown in pieces rather than waited for. */
const LONGEST_WORD = 24

export interface Pace {
  /** Characters shown. */
  shown: number
  /** Characters a millisecond, as of the last step. */
  speed: number
}

const isSpace = (code: number) => code === 32 || code === 10 || code === 9 || code === 13
/** CJK and kana are written without spaces: every character there is a place to stop. */
const isWide = (code: number) => code >= 0x2e80 && code <= 0xffef

/** Where the last word of `text` begins, or its length when it ends on a break. */
function lastWordStart(text: string): number {
  let at = text.length
  while (at > 0) {
    const code = text.charCodeAt(at - 1)
    if (isSpace(code) || isWide(code)) break
    at--
  }
  return at
}

/**
 * How much of `text` may be shown: all of it once it is `settled`, and otherwise all but a last
 * word that is still being typed. A long token (a URL, a hash) is not waited for.
 */
export function showable(text: string, settled: boolean): number {
  if (settled) return text.length
  const start = lastWordStart(text)
  return text.length - start > LONGEST_WORD ? text.length : start
}

/** From `at`, the end of the word it is inside (and the spaces after it), no further than `limit`. */
export function wordEnd(text: string, at: number, limit: number): number {
  if (at >= limit) return limit
  let end = at
  const reach = Math.min(limit, at + LONGEST_WORD)
  while (end < reach) {
    const code = text.charCodeAt(end)
    if (isSpace(code) || isWide(code)) break
    end++
  }
  // No break in reach: a long token, shown as far as the pace got.
  if (end === reach && reach < limit) return at
  while (end < limit && isSpace(text.charCodeAt(end))) end++
  // A surrogate pair is one character.
  if (end < limit && isLowSurrogate(text.charCodeAt(end))) end++
  return end
}

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff

/**
 * One step: how much of `text` is shown `elapsed` ms after `pace`. `settled` says no more of the
 * last word is coming (the reply ended, or has stood still for a moment).
 */
export function advance(
  text: string,
  pace: Pace,
  elapsed: number,
  catchUp: number,
  settled: boolean,
): Pace {
  const limit = showable(text, settled)
  if (pace.shown >= limit) return { shown: Math.min(pace.shown, text.length), speed: 0 }
  const backlog = limit - pace.shown
  const wanted = backlog / catchUp
  const speed = pace.speed + (wanted - pace.speed) * Math.min(1, elapsed / EASE_MS)
  const reached = Math.min(limit, pace.shown + Math.max(1, Math.round(speed * elapsed)))
  let shown = wordEnd(text, reached, limit)
  if (shown < text.length && isLowSurrogate(text.charCodeAt(shown))) shown++
  return { shown, speed }
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const now = () => (typeof performance === 'undefined' ? 0 : performance.now())

function commonPrefix(a: string, b: string): number {
  const limit = Math.min(a.length, b.length)
  let at = 0
  while (at < limit && a.charCodeAt(at) === b.charCodeAt(at)) at++
  return at
}

/**
 * The pacer of one text: how much of it is shown, and the frame loop that shows more. It lives
 * outside React's state on purpose: the length belongs to the text it was counted in, and is
 * corrected in the same render that brings a new text, never a frame later.
 */
function createPacer(initial: string) {
  // Text that is there from the start (a settled reply, a remount mid-stream) is not replayed.
  let text = initial
  let pace: Pace = { shown: initial.length, speed: 0 }
  let streaming = false
  let grew = 0
  let stepped = 0
  let frame = 0

  return {
    /** The length of `next` to show now. */
    take(next: string, live: boolean): number {
      if (next !== text) {
        // A reply that is not streaming is shown whole, whatever it was before. Otherwise, a
        // different text, not a longer one (a regenerated reply, an edit): keep what they share.
        const shown =
          !live && !streaming
            ? next.length
            : continues(next, text, pace.shown)
              ? pace.shown
              : commonPrefix(text, next)
        text = next
        pace = { shown, speed: pace.speed }
        grew = now()
      }
      streaming = live
      if (pace.shown < text.length && reducedMotion()) pace = { shown: text.length, speed: 0 }
      return Math.min(pace.shown, text.length)
    },
    /** Show the rest, a step at a time; `redraw` is called after each step that showed more. */
    run(catchUp: number, redraw: () => void) {
      if (frame !== 0 || pace.shown >= text.length) return
      stepped = now()
      const step = (time: number) => {
        const elapsed = time - stepped
        if (elapsed >= STEP_MS) {
          stepped = time
          // A reply that has stood still for a moment is not in the middle of a word.
          const settled = !streaming || time - grew > PAUSE_MS
          const next = advance(text, pace, elapsed, catchUp, settled)
          const moved = next.shown !== pace.shown
          pace = next
          if (moved) redraw()
        }
        frame = pace.shown < text.length ? requestAnimationFrame(step) : 0
      }
      frame = requestAnimationFrame(step)
    },
    stop() {
      cancelAnimationFrame(frame)
      frame = 0
    },
  }
}

/**
 * `text` as it should be shown now. While `streaming`, growth is paced; when it stops, what is
 * left is shown out. The second value says whether the shown text is still behind: a caller keeps
 * its "still arriving" look until it is false.
 */
export function useSmoothText(
  text: string,
  streaming: boolean,
  catchUp: number = DEFAULT_CATCH_UP_MS,
): [shown: string, behind: boolean] {
  const [pacer] = useState(() => createPacer(text))
  const [, setDrawn] = useState(0)
  const end = pacer.take(text, streaming)

  // `text` and `streaming` are here to start the loop again when there is more to show.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    pacer.run(catchUp, () => setDrawn((count) => count + 1))
  }, [pacer, text, streaming, catchUp])
  useEffect(() => () => pacer.stop(), [pacer])

  return [end >= text.length ? text : text.slice(0, end), end < text.length]
}
