/**
 * A block that is one table, read without parsing it: what a renderer needs to draw a long table
 * in pieces, a token costing only its last rows.
 */
const ROW = /^ {0,3}\|/
const DELIMITER_CELL = /^[ \t]*:?-+:?[ \t]*$/

/** The cells of a row written with its outer pipes. Null when a pipe could be an escaped one. */
function cells(line: string): string[] | null {
  if (line.includes('\\')) return null
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return inner.split('|')
}

/** A table's header (its two lines, each with its line break) and its body rows. */
export interface TableRows {
  head: string
  rows: string[]
}

/**
 * The header (its two lines) and the body rows of a block that is one table and nothing else:
 * every line opens with a pipe, so none of them can be anything but a row. Null for any other
 * block, and for a table this cannot read with certainty; those are drawn by one parse, as ever.
 */
export function tableRows(source: string): TableRows | null {
  const text = source.replace(/^\n+/, '').trimEnd()
  if (text.charCodeAt(0) !== 124 && !ROW.test(text)) return null
  const lines = text.split('\n')
  if (lines.length < 3 || !lines.every((line) => ROW.test(line))) return null
  const header = cells(lines[0]!)
  const delimiter = cells(lines[1]!)
  if (!header || !delimiter || header.length !== delimiter.length) return null
  if (!delimiter.every((cell) => DELIMITER_CELL.test(cell))) return null
  if (!header.some((cell) => cell.trim())) return null
  return { head: `${lines[0]}\n${lines[1]}\n`, rows: lines.slice(2) }
}
