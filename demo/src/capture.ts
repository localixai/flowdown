/**
 * The README's pictures, into docs/assets/readme: the scenes in light and dark
 * (`<scene>-<theme>.png`), the hero reply streaming (`stream-<theme>.png`, animated) and a diagram
 * enlarged, zoomed and panned in its viewer (`viewer-<theme>.png`, animated). Each animation also
 * gets an `.mp4` and a `.gif` beside it, for sites that do not play APNG. Needs Playwright's Chromium
 * (`bunx playwright-core install chromium-headless-shell`) and ffmpeg for the animation.
 *
 *   bun run shots              everything
 *   bun run shots steps viewer   those pictures only (`stream` and `viewer` are the animations)
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
    // The reply's source, not its text: a drawn diagram's own styles are text too.
    const mathDone = !window.demo?.reply.includes('$') || reply.querySelector('.katex')
    const diagrams = reply.querySelectorAll('.llx-diagram')
    const drawn = [...diagrams].every((node) => node.querySelector('.llx-diagram-canvas svg'))
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
  // A diagram's toolbar shows under the pointer: the picture has it.
  const diagram = page.locator('.llx-diagram').first()
  if ((await diagram.count()) > 0) await diagram.hover()
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
    encode(frames, index, join(OUT, `stream-${theme}.png`), 3)
    console.log(`  stream-${theme}.png (${index} frames)`)
  } finally {
    await rm(frames, { recursive: true, force: true })
  }
}

/**
 * The numbered frames of `frames` as an animated PNG, not a GIF: lossless and in full colour at the
 * captured 2× size, where a GIF's 256 colours smear the anti-aliased text and lose the small
 * coloured marks. 20 frames a second, then the last frame held for `hold` seconds.
 */
function encode(frames: string, count: number, path: string, hold: number) {
  const last = join(frames, `${String(count - 1).padStart(4, '0')}.png`)
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
    String(hold),
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
  shareable(path)
}

/**
 * Copies of an animated PNG for places that do not play one, such as Reddit, which shows APNG still
 * or not at all: an MP4 at full size, and a GIF 1000 pixels wide whose palette is fitted to the
 * frames, written next to it with the same name.
 */
function shareable(apng: string) {
  const base = apng.replace(/\.png$/, '')
  const runs = [
    [
      '-vf',
      'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '20',
      '-movflags',
      '+faststart',
      `${base}.mp4`,
    ],
    [
      '-vf',
      'scale=1000:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
      '-loop',
      '0',
      `${base}.gif`,
    ],
  ]
  for (const args of runs) {
    const ffmpeg = Bun.spawnSync(['ffmpeg', '-y', '-loglevel', 'error', '-i', apng, ...args])
    if (ffmpeg.exitCode !== 0) throw new Error(ffmpeg.stderr.toString())
  }
}

/** A pointer drawn on the page (a headless browser has none), in whatever layer is on top. */
const POINTER = `
  const pointer = document.createElement('div')
  pointer.style.cssText =
    'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:22px;height:22px;' +
    'margin:-3px 0 0 -5px;filter:drop-shadow(0 1px 2px rgb(0 0 0 / .45))'
  pointer.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8.5-6.2 1.3 3.6 6.7-2.6 1.4-3.6-6.8L5 18.5z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  addEventListener('mousemove', (event) => {
    const layer = document.querySelector('dialog[open]') ?? document.body
    if (pointer.parentNode !== layer) layer.append(pointer)
    pointer.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)'
  }, true)
`

/**
 * A diagram's toolbar and viewer, as a person uses them: the pointer comes to the diagram, Enlarge
 * opens the viewer, the wheel zooms in, a drag pans, Fit shows it whole again and Close returns.
 */
async function viewer(page: Page, base: string, theme: string) {
  await page.goto(`${base}?scene=viewer&theme=${theme}`)
  await settled(page)
  const height = await page.locator('[data-scene]').evaluate((node) => node.scrollHeight)
  await page.setViewportSize({ width: 760, height: Math.max(height, 620) })
  await page.evaluate(POINTER)

  const frames = await mkdtemp(join(tmpdir(), 'llx-demo-'))
  try {
    let index = 0
    let at = { x: 700, y: 40 }
    /** `count` frames, a twentieth of a second apart, so transitions are seen running. */
    const hold = async (count: number) => {
      for (let frame = 0; frame < count; frame += 1) {
        await page.screenshot({ path: join(frames, `${String(index++).padStart(4, '0')}.png`) })
        await page.waitForTimeout(30)
      }
    }
    const glide = async (to: { x: number; y: number }, steps = 10) => {
      const from = at
      for (let step = 1; step <= steps; step += 1) {
        // Ease in and out, as a hand does.
        const t = (1 - Math.cos((step / steps) * Math.PI)) / 2
        at = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
        await page.mouse.move(at.x, at.y)
        await hold(1)
      }
    }
    const middle = async (selector: string) => {
      const box = (await page.locator(selector).boundingBox())!
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }
    const button = (label: string) => `button[aria-label^="${label}"]`

    await page.mouse.move(at.x, at.y)
    await hold(8)
    await glide(await middle(`.llx-diagram ${button('Enlarge')}`), 14)
    await hold(6)
    await page.mouse.click(at.x, at.y)
    await page.waitForSelector('dialog[open] svg')
    await hold(10)

    const stage = await middle('dialog[open] .llx-diagram-viewer-canvas')
    await glide({ x: stage.x - 60, y: stage.y - 40 }, 10)
    for (let notch = 0; notch < 9; notch += 1) {
      await page.mouse.wheel(0, -70)
      await hold(1)
    }
    await hold(6)
    await page.mouse.down()
    await glide({ x: at.x + 190, y: at.y + 110 }, 12)
    await page.mouse.up()
    await hold(8)

    await glide(await middle(`dialog[open] ${button('Fit')}`), 12)
    await page.mouse.click(at.x, at.y)
    await hold(12)
    await glide(await middle(`dialog[open] ${button('Close')}`), 10)
    await hold(4)
    await page.mouse.click(at.x, at.y)
    await hold(10)

    encode(frames, index, join(OUT, `viewer-${theme}.png`), 1.5)
    console.log(`  viewer-${theme}.png (${index} frames)`)
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
    // The hero and the viewer are animations, not stills.
    for (const scene of Object.keys(scenes).filter((name) => name !== 'hero' && name !== 'viewer'))
      if (wanted(scene)) await still(page, server.url.href, scene, theme)
    if (wanted('stream')) await stream(page, server.url.href, theme)
    if (wanted('viewer')) await viewer(page, server.url.href, theme)
    await page.close()
  }
} finally {
  await browser.close()
  server.stop(true)
}
