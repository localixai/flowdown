import { describe, expect, test } from 'bun:test'
import { createFenceScanner, fenceScanStats } from './fence-scan'

describe('a fence scanner', () => {
  test('two documents that grow in turn each read only their new lines', () => {
    // Counts scanned lines instead of timing: wall-clock budgets flake on shared CI runners.
    const first = createFenceScanner()
    const second = createFenceScanner()
    const lines = 500
    let one = '```ts\n'
    let two = 'Some prose.\n\n~~~py\n'
    const before = fenceScanStats.lines
    for (let i = 0; i < lines; i += 1) {
      one += `const a${i} = ${i}\n`
      two += `b${i} = ${i}\n`
      expect(first(one)?.marker).toBe('```')
      expect(second(two)?.marker).toBe('~~~')
    }
    // One scanner for both would start over on every call: about lines² lines in all.
    expect(fenceScanStats.lines - before).toBeLessThanOrEqual(2 * lines + 4)
  })

  test('a scanner answers for its own text, whatever another one read', () => {
    const first = createFenceScanner()
    const second = createFenceScanner()
    expect(first('```js\nlet a')).not.toBeNull()
    expect(second('No fence here.\n')).toBeNull()
    expect(first('```js\nlet a = 1\n')).not.toBeNull()
    expect(first('```js\nlet a = 1\n```\n')).toBeNull()
    expect(second('No fence here.\n\n~~~\nopen')).not.toBeNull()
  })

  test('a text that is not the one it followed is read from its start', () => {
    const scan = createFenceScanner()
    expect(scan('```\nopen\n')).not.toBeNull()
    expect(scan('Another reply.\n')).toBeNull()
    expect(scan('```\nopen\n')).not.toBeNull()
  })
})
