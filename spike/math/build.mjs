// Writes page.html: every formula of the corpus, once per way of drawing it, side by side, and
// renders.json: each way's output per formula (what the browser measures and screenshots).
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs'
import katex from 'katex'
import temml from 'temml'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'
import { CORPUS } from './corpus.mjs'

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)
const mj = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: 'local' }) })
const svg = (tex, display) => adaptor.outerHTML(mj.convert(tex, { display }))

export const WAYS = {
  katex: { label: 'KaTeX (HTML+CSS)', render: (tex, display) => katex.renderToString(tex, { displayMode: display, throwOnError: false }) },
  native: { label: 'MathML, browser fonts', render: (tex, display) => temml.renderToString(tex, { displayMode: display }) },
  stix: { label: 'MathML + STIX Two Math', render: (tex, display) => temml.renderToString(tex, { displayMode: display }) },
  noto: { label: 'MathML + Noto Sans Math', render: (tex, display) => temml.renderToString(tex, { displayMode: display }) },
  svg: { label: 'SVG (MathJax)', render: svg },
}

mkdirSync('out/fonts', { recursive: true })
copyFileSync('node_modules/katex/dist/katex.min.css', 'out/katex.min.css')
// Temml's own stylesheet: its WebKit and Chromium workarounds (accents, stretchy braces) live there.
copyFileSync('node_modules/temml/dist/Temml-Local.css', 'out/temml.css')
copyFileSync('node_modules/temml/dist/Temml.woff2', 'out/Temml.woff2')
for (const f of ['stix-two-math', 'noto-sans-math']) copyFileSync(`node_modules/@fontsource/${f}/files/${f}-latin-400-normal.woff2`, `out/fonts/${f}.woff2`)
mkdirSync('out/fonts-katex', { recursive: true })
const katexCss = readFileSync('out/katex.min.css', 'utf8').replaceAll('url(fonts/', 'url(fonts-katex/')
writeFileSync('out/katex.min.css', katexCss)
for (const file of katexCss.match(/KaTeX_[\w-]+\.woff2/g) ?? []) copyFileSync(`node_modules/katex/dist/fonts/${file}`, `out/fonts-katex/${file}`)

const rows = CORPUS.map(([name, tex, display]) => {
  const cells = Object.entries(WAYS).map(([way, { render }]) => `<td class="${way}">${render(tex, display)}</td>`)
  return `<tr><th>${name}</th>${cells.join('')}</tr>`
})
const head = Object.values(WAYS).map(({ label }) => `<th>${label}</th>`).join('')
writeFileSync('out/page.html', `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="katex.min.css">
<link rel="stylesheet" href="temml.css">
<style>
@font-face { font-family: 'STIX Two Math'; src: url(fonts/stix-two-math.woff2) format('woff2'); font-display: block }
@font-face { font-family: 'Noto Sans Math'; src: url(fonts/noto-sans-math.woff2) format('woff2'); font-display: block }
body { margin: 16px; font: 15px/1.4 system-ui, sans-serif; background: #fff; color: #111 }
table { border-collapse: collapse }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: center; vertical-align: middle }
th { font-weight: 600; font-size: 13px; background: #f6f6f6 }
tbody th { text-align: left; white-space: nowrap }
td { font-size: 18px }
math { font-size: 1.21em }
math[display=block] { display: block math }
.stix math { font-family: 'STIX Two Math', math }
.noto math { font-family: 'Noto Sans Math', math }
.native math { font-family: math }
.svg svg { vertical-align: middle }
</style>
<table><thead><tr><th></th>${head}</tr></thead><tbody>${rows.join('\n')}</tbody></table>`)
console.log('wrote out/page.html')
