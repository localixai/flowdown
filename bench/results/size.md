# Bundle size

What a page downloads for each library, without React. `bun run size` in bench/ writes this file; [src/size.ts](../src/size.ts) says how it is measured.

| | At once (gzip) | On demand (gzip) | Minified, all |
| --- | --- | --- | --- |
| llx-markdown | 89.4 KB (budget 95 KB) | 47.8 KB | 463 KB |
| llx-markdown + highlight | 110.1 KB | 47.8 KB | 529 KB |
| llx-markdown/stream | 17.1 KB | — | 55 KB |
| react-markdown + remark-gfm | 57.5 KB | — | 195 KB |
| streamdown | 162.9 KB | 0.4 KB | 550 KB |
