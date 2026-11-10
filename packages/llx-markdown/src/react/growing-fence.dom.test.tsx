/**
 * An agent writing a file streams one fence that grows to hundreds of lines. Each token must cost
 * the end of the fence, not all of it: the lines above are drawn (and highlighted) once. What the
 * person sees is the code as it arrives, and once the fence closes, the same block as ever.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { prefixes } from '../../test/chunks'
import { registerDom } from '../../test/dom'
import { openFence } from '../core/fence-scan'
import { growingFence } from './growing-code'
import { Markdown } from './markdown'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

const LINES = Array.from(
  { length: 600 },
  (_, i) => `  const value${i} = await load(${i}) // step ${i}`,
)
const reply = `Here is the file:\n\n\`\`\`ts\n${LINES.join('\n')}\n\`\`\`\n\nDone.`

/** A highlighter that counts what it is given and marks every line, so its output is visible. */
function countingHighlighter() {
  const counter = { chars: 0 }
  const highlight = (code: string, language: string) => {
    counter.chars += code.length
    return language === 'ts'
      ? code.replace(/const/g, '<span class="hl-keyword">const</span>')
      : null
  }
  return { counter, highlight }
}

async function mount() {
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const host = document.createElement('div')
  document.body.append(host)
  const handle = createRoot(host)
  return {
    host,
    render: (node: ReactNode) => act(async () => handle.render(node)),
    close: async () => {
      await act(async () => handle.unmount())
      host.remove()
    },
  }
}

describe('a fence that grows while the reply streams', () => {
  test('each token highlights the end of the fence, not all of it', async () => {
    const { counter, highlight } = countingHighlighter()
    const page = await mount()
    const frames = prefixes(reply, 'frame')
    for (const frame of frames)
      await page.render(
        <Markdown streaming highlight={highlight}>
          {frame}
        </Markdown>,
      )
    await page.close()
    // Highlighting the whole fence on every frame is about length × frames / 2.
    const whole = (reply.length * frames.length) / 2
    expect(counter.chars).toBeLessThan(whole / 10)
  })

  test('shows every line that has arrived, highlighted, under its language', async () => {
    const { highlight } = countingHighlighter()
    const page = await mount()
    const cut = reply.indexOf('value300')
    await page.render(
      <Markdown streaming highlight={highlight}>
        {reply.slice(0, cut)}
      </Markdown>,
    )
    const code = page.host.querySelector('pre code')
    expect(page.host.querySelector('.llx-code')?.getAttribute('data-language')).toBe('ts')
    expect(code?.textContent).toBe(reply.slice(reply.indexOf('  const value0'), cut))
    expect(code?.querySelectorAll('.hl-keyword').length).toBe(301)
    await page.close()
  })

  test('once the reply is finished, the block is the one a finished reply always gets', async () => {
    const { highlight } = countingHighlighter()
    const streamed = await mount()
    for (const frame of prefixes(reply, 'frame')) {
      await streamed.render(
        <Markdown streaming highlight={highlight}>
          {frame}
        </Markdown>,
      )
    }
    await streamed.render(<Markdown highlight={highlight}>{reply}</Markdown>)
    const fresh = await mount()
    await fresh.render(<Markdown highlight={highlight}>{reply}</Markdown>)
    expect(streamed.host.innerHTML).toBe(fresh.host.innerHTML)
    await streamed.close()
    await fresh.close()
  })

  test("a page's own code element still receives the growing fence", async () => {
    const page = await mount()
    const seen: string[] = []
    const components = {
      code: ({ children }: { children?: ReactNode }) => {
        seen.push(String(children))
        return <code data-own>{children}</code>
      },
    }
    await page.render(
      <Markdown streaming components={components}>
        {reply.slice(0, 400)}
      </Markdown>,
    )
    expect(page.host.querySelector('code[data-own]')).not.toBeNull()
    expect(seen.at(-1)).toContain('const value0')
    await page.close()
  })

  test('a reply written again in the middle of its fence shows the new code', async () => {
    const page = await mount()
    const first = reply.slice(0, reply.indexOf('value400'))
    for (const frame of prefixes(first, 'frame').slice(-40))
      await page.render(<Markdown streaming>{frame}</Markdown>)
    // The same opening and first lines, then other code, as long as the first was.
    const other = first.slice(0, 2_000) + first.slice(2_000).replaceAll('value', 'other')
    await page.render(<Markdown streaming>{other}</Markdown>)
    const code = page.host.querySelector('pre code')
    // Code that is not highlighted ends in a newline, as a finished block's does.
    expect(code?.textContent).toBe(`${other.slice(other.indexOf('  const value0'))}\n`)
    // And it goes on growing from there.
    const more = `${other}\n  done()\n`
    await page.render(<Markdown streaming>{more}</Markdown>)
    expect(code?.textContent).toBe(more.slice(more.indexOf('  const value0')))
    await page.close()
  })

  test('Copy takes the code as it is now, though the bar was drawn when the fence opened', async () => {
    const page = await mount()
    const copied: string[] = []
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void copied.push(text) },
    })
    try {
      const cut = reply.indexOf('value200')
      for (const frame of prefixes(reply.slice(0, cut), 'frame').slice(-30))
        await page.render(<Markdown streaming>{frame}</Markdown>)
      const { act } = await import('react')
      const button = page.host.querySelector<HTMLButtonElement>('.llx-code-copy')
      await act(async () => button?.click())
      expect(copied).toEqual([reply.slice(reply.indexOf('  const value0'), cut)])
    } finally {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
    await page.close()
  })
})

describe('the fence read beside the line that closes it', () => {
  const F = '```'
  const SOURCES = [
    `${F}ts title="src/app.ts"\nexport const a = 1\n\n\nexport const b = 2\n  ${F}\nlast`,
    `~~~py\nprint(1)\n${F}\nstill code\n~~~~\nmore`,
    `${F}${F}md\n${F}js\ninner\n${F}\nmore\n`,
    `${F}js\none\n${F}\ntext right after\n${F}ts\ntwo\nthree`,
    `${F}\n\n\n`,
  ]

  test('is the fence read with that line joined to it, at every length', () => {
    for (const source of SOURCES) {
      for (let end = 1; end <= source.length; end += 1) {
        const text = source.slice(0, end)
        const fence = openFence(text)
        if (!fence) continue
        const closer = `${text.endsWith('\n') ? '' : '\n'}${fence.marker}`
        const beside = growingFence(text, closer)
        // Another fence in between: what was remembered of the last one must not be used for it.
        growingFence(`${F}js\nunrelated\n`, F)
        expect(beside).toEqual(growingFence(text + closer))
      }
    }
  })
})
