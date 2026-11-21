import { chromium, firefox, webkit } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join } from 'node:path'
const types = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  const file = join('out', decodeURIComponent(req.url.split('?')[0]))
  if (!existsSync(file)) { res.statusCode = 404; return res.end() }
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
  res.end(readFileSync(file))
}).listen(4180)
const engines = { chromium, firefox, webkit }
const want = (process.env.ENGINES ?? 'chromium').split(',')
const tag = process.env.TAG ?? process.platform
for (const name of want) {
  const opts = name === 'chromium' && process.env.CHROME ? { executablePath: process.env.CHROME } : {}
  const browser = await engines[name].launch(opts)
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 })
  await page.goto('http://localhost:4180/page.html')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `out/shot-${tag}-${name}.png`, fullPage: true })
  console.log('shot', tag, name)
  await browser.close()
}
server.close()
