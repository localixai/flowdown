/**
 * The README's pictures: every scene but the hero in light and dark (`<scene>-<theme>.png`) and the hero reply
 * streaming (`stream-<theme>.png`, animated), into docs/assets/readme. Needs Playwright's Chromium
 * (`bunx playwright-core install chromium-headless-shell`) and ffmpeg for the animation.
 *
 *   bun run shots              everything
 *   bun run shots hero steps   those scenes, no animation unless `stream` is named
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright-core'
import { scenes } from './scenes'
import { serve } from './serve'

const OUT = join(import.meta.dir, '../../docs/assets/readme')
const THEMES = ['light', 'dark'] as const
const SCALE = 2

const asked = process.argv.slice(2)
const wanted = (name: string) => asked.length === 0 || asked.includes(name)

/** Everything the scene loads is drawn: formulas, diagrams, fonts, and a frame after that. */
async function settled(page: Page) {
  await page.waitForSelector('.llx-markdown')
  await page.waitForFunction(() => {
    const reply = document.querySelector('.reply')!
    const text = reply.textContent ?? ''
    const mathDone = !text.includes('$') || reply.querySelector('.katex')
    const diagrams = reply.querySelectorAll('[data-diagram], .llx-diagram')
    const drawn = [...diagrams].every((node) => node.querySelector('svg'))
    return mathDone && drawn
  })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 250))),
  )
}

async function still(page: Page, base: string, scene: string, theme: string) {
  await page.goto(`${base}?scene=${scene}&theme=${theme}`)
  await settled(page)
  const path = join(OUT, `${scene}-${theme}.png`)
  await page.locator('[data-scene]').screenshot({ path, animations: 'disabled' })
  console.log(`  ${scene}-${theme}.png`)
}

/** The hero reply typed in 5-character steps at 20 frames a second, as a model streams it, then held finished. */
async function stream(page: Page, base: string, theme: string) {
  await page.goto(`${base}?scene=hero&theme=${theme}`)
  await settled(page)
  const height = await page.locator('[data-scene]').evaluate((node) => node.scrollHeight)
  await page.setViewportSize({ width: 760, height })
  await page.goto(`${base}?scene=hero&theme=${theme}&stream`)
  await page.waitForFunction(() => window.demo)
  const reply = await page.evaluate(() => window.demo.reply)

  const frames = await mkdtemp(join(tmpdir(), 'llx-demo-'))
  try {
    let index = 0
    const shoot = async (text: string, streaming: boolean) => {
      await page.evaluate(([value, live]) => window.demo.show(value, live), [
        text,
        streaming,
      ] as const)
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      )
      await page.screenshot({ path: join(frames, `${String(index++).padStart(4, '0')}.png`) })
    }
    await shoot('', true)
    for (let end = 5; end < reply.length; end += 5) await shoot(reply.slice(0, end), true)
    await shoot(reply, false)
    const last = join(frames, `${String(index - 1).padStart(4, '0')}.png`)

    // An animated PNG, not a GIF: lossless and in full colour at the captured 2× size, where a GIF's
    // 256 colours smear the anti-aliased text and lose the small coloured marks. 20 frames a second
    // while streaming, then the finished reply held for three seconds.
    const path = join(OUT, `stream-${theme}.png`)
    const ffmpeg = Bun.spawnSync([
      'ffmpeg',
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      '20',
      '-i',
      join(frames, '%04d.png'),
      '-loop',
      '1',
      '-t',
      '3',
      '-framerate',
      '20',
      '-i',
      last,
      '-filter_complex',
      '[0:v][1:v]concat=n=2:v=1,format=rgb24',
      '-f',
      'apng',
      '-plays',
      '0',
      path,
    ])
    if (ffmpeg.exitCode !== 0) throw new Error(ffmpeg.stderr.toString())
    console.log(`  stream-${theme}.png (${index} frames)`)
  } finally {
    await rm(frames, { recursive: true, force: true })
  }
}

await mkdir(OUT, { recursive: true })
const server = serve()
const browser = await chromium.launch()
try {
  for (const theme of THEMES) {
    const page = await browser.newPage({
      viewport: { width: 760, height: 900 },
      deviceScaleFactor: SCALE,
      colorScheme: theme,
    })
    // The hero reply is the animation, not a still.
    for (const scene of Object.keys(scenes).filter((name) => name !== 'hero'))
      if (wanted(scene)) await still(page, server.url.href, scene, theme)
    if (asked.length === 0 || asked.includes('stream')) await stream(page, server.url.href, theme)
    await page.close()
  }
} finally {
  await browser.close()
  server.stop(true)
}
