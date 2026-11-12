import { seeded } from './random'

/**
 * How a host hands the renderer a reply that is still arriving. Each pattern returns the growing
 * prefixes the renderer is given, one per update.
 *
 * - `token`: what an LLM API streams, 1 to 12 characters at a time (about 4 on average).
 * - `frame`: what a host that batches per frame passes, 20 characters per update, the pattern
 *   markstream's benchmarks use (20-character chunks at 30 Hz is 600 characters a second).
 * - `line`: a host that flushes on newlines.
 */
export type Pattern = 'token' | 'frame' | 'line'

export function prefixes(text: string, pattern: Pattern, seed = 42): string[] {
  const out: string[] = []
  if (pattern === 'line') {
    for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1))
      out.push(text.slice(0, at + 1))
  } else {
    const r = seeded(seed)
    for (let end = 0; end < text.length;) {
      end = Math.min(
        text.length,
        end + (pattern === 'frame' ? 20 : r.int(1, 7) + (r.next() < 0.1 ? 5 : 0)),
      )
      out.push(text.slice(0, end))
    }
  }
  if (out.at(-1) !== text) out.push(text)
  return out
}
