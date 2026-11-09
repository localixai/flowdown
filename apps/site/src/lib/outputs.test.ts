import { expect, test } from 'bun:test'
import { fillTemplate } from './outputs'

test('a page keeps its dollars exactly as rendered, so it hydrates', () => {
  const html = "<p>$$x$$ costs $5, see $HOME and $'quoted'$&</p>"
  const page = fillTemplate('<head><!--app-head--></head><div><!--app-html--></div>', '<title>$$</title>', html)
  expect(page).toBe(`<head><title>$$</title></head><div>${html}</div>`)
})
