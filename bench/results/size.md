# Bundle size

What a page downloads for each library, without React. `bun run size` in bench/ writes this file; [src/size.ts](../src/size.ts) says how it is measured.

| | At once (gzip) | On demand (gzip) | Minified, all |
| --- | --- | --- | --- |
| llx-markdown | 29.4 KB (budget 88 KB) | 14.2 KB | 103 KB |
| llx-markdown + highlight | 50.5 KB | 14.2 KB | 171 KB |
| llx-markdown/stream | 4.3 KB | — | 10 KB |
| react-markdown + remark-gfm | 50.0 KB | — | 167 KB |
| streamdown | 155.5 KB | 0.4 KB | 522 KB |
| markdown-to-jsx | 31.0 KB | — | 85 KB |
| markstream-react | 211.5 KB | 8.3 KB | 668 KB |
| marked-react | 26.9 KB | — | 70 KB |
