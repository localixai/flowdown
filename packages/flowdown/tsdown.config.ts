import { defineConfig } from 'tsdown'

/**
 * One ESM file per source module (`unbundle`), the way Starlight, Fumadocs and assistant-ui ship:
 * a page's bundler then drops what it does not import, each `'use client'` stays on the module it
 * marks, and `flowdown/stream` never reaches the React modules. Dependencies stay imports.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'static/index': 'src/static/index.ts',
    'dom/index': 'src/dom/index.ts',
    'element/index': 'src/element/index.ts',
    'tui/index': 'src/tui/index.ts',
    'document/index': 'src/document/index.ts',
    'engine/index': 'src/engine/index.ts',
    remark: 'src/remark.ts',
    stream: 'src/stream.ts',
    'prompt/index': 'src/prompt/index.ts',
    'html/index': 'src/html/index.ts',
    'math/index': 'src/math/index.ts',
    'highlight/index': 'src/highlight/index.ts',
    'mermaid/index': 'src/mermaid/index.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  unbundle: true,
  dts: true,
  sourcemap: true,
  clean: true,
  exports: false,
  publint: false,
  // Unbundled output keeps each module's `'use client'` where it was written (the package check
  // fails the build when one is lost); the bundler's warning that it might not is for bundles.
  inputOptions: { checks: { moduleLevelDirective: false } },
})
