/**
 * A reply streamed into a terminal. `reply.md` holds every form the renderer knows; it arrives a
 * few characters at a time, the way a model sends it, and `flowdown/tui` draws it as it grows.
 *
 *     bun start                     # from this folder
 *     bun stream.ts notes.md        # a file of your own
 *     DELAY=0 bun stream.ts         # as fast as the terminal takes it; 12 ms a token by default
 *     bun stream.ts | cat           # not a terminal: the finished reply, once, without colours
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { highlight } from 'flowdown/highlight'
import { createTerminalView, toAnsi, type Line } from 'flowdown/tui'

const reply = readFileSync(process.argv[2] ?? join(import.meta.dirname, 'reply.md'), 'utf8')
const out = process.stdout
const color = !process.env.NO_COLOR
const delay = Number(process.env.DELAY ?? 12)
/** A line of prose reads best under a hundred columns, however wide the window. */
const columns = () => Math.min(out.columns || 80, 100)
const view = createTerminalView({ width: columns(), highlight })

/** The rows on the screen, as they were written. */
let shown: string[] = []

/** Writes `lines` over what is shown: only from the first row that changed. */
function draw(lines: Line[]): void {
  const rows = lines.map((line) => toAnsi([line], color))
  let same = 0
  while (same < shown.length && same < rows.length && shown[same] === rows[same]) same++
  // The cursor cannot climb past the top of the window: a row scrolled out of it stays as written.
  const up = Math.min(shown.length - same, (out.rows || 24) - 1)
  const from = shown.length - up
  const back = up > 0 ? `\u001b[${up}A` : ''
  // Up to the first changed row, clear from there down, write the rest.
  out.write(
    `${back}\r\u001b[J${rows
      .slice(from)
      .map((row) => `${row}\n`)
      .join('')}`,
  )
  shown = rows
}

/** The text cut into tokens of one to five characters; a character is never cut in two. */
function* tokens(text: string): Generator<string> {
  const characters = [...text]
  for (let at = 0, turn = 0; at < characters.length; turn++) {
    const size = 1 + ((turn * 7) % 5)
    yield characters.slice(at, at + size).join('')
    at += size
  }
}

if (out.isTTY) {
  out.write('\u001b[?25l')
  process.on('exit', () => out.write('\u001b[?25h'))
  process.on('SIGINT', () => process.exit(130))
  // A window resized wraps every row anew: start the screen over at its new width.
  out.on('resize', () => {
    out.write('\u001b[2J\u001b[3J\u001b[H')
    shown = []
  })
  let text = ''
  for (const token of tokens(reply)) {
    text += token
    draw(view.render(text, { streaming: true, width: columns() }))
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  }
  draw(view.render(text, { width: columns() }))
} else {
  out.write(`${toAnsi(view.render(reply), false)}\n`)
}
