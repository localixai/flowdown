# Benchmark results, in a browser

- **date:** 2026-11-15T07:20:42.488Z
- **commit:** ae31373
- **dirty:** false
- **cpu:** Apple M5
- **cores:** 10
- **os:** darwin arm64
- **browser:** Chromium 156.0.8078.4
- **runs:** 3
- **perFrame:** 6
- **budgetMs:** 30000
- **renderers:** flowdown 0.6.1, streamdown 2.7.1, react-markdown 10.1.0, markdown-to-jsx 9.10.6, markstream 2.0.24, marked-react 4.0.0

Each renderer streams the reply in Chromium, 6 updates per animation frame. The numbers are
the browser's own counters, the median of 3 runs. Lower is better. "Stopped" means the renderer
spent the time budget (30,000 ms inside its updates) before the reply
ended, and how far it had got.

## Script

Time the main thread spent running script while the reply streamed.

| | `flowdown` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 94.9 ms | 336 ms | 933 ms | 143 ms | 271 ms | 233 ms |
| answer-20k · token | 314 ms | 1,833 ms | 10,829 ms | 1,128 ms | 1,618 ms | 1,434 ms |
| table-20k · token | 148 ms | 16,836 ms | 13,331 ms | 1,222 ms | 4,100 ms | 1,327 ms |
| code-50k · token | 377 ms | 19,410 ms | 10,331 ms | 562 ms | 6,490 ms | 545 ms |
| long-100k · token | 1,156 ms | 16,339 ms | stopped at 33% | 16,449 ms | 23,415 ms | 20,828 ms |

## The whole main thread

Script, style, layout and paint together: everything that kept the page from answering.

| | `flowdown` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 186 ms | 399 ms | 981 ms | 199 ms | 334 ms | 298 ms |
| answer-20k · token | 745 ms | 2,111 ms | 11,048 ms | 1,351 ms | 2,147 ms | 1,650 ms |
| table-20k · token | 298 ms | 17,214 ms | 13,667 ms | 1,556 ms | 4,822 ms | 1,642 ms |
| code-50k · token | 1,852 ms | 24,326 ms | 13,038 ms | 3,923 ms | 10,004 ms | 3,697 ms |
| long-100k · token | 3,202 ms | 18,664 ms | stopped at 33% | 18,441 ms | 27,623 ms | 22,242 ms |

## One update

The 95th percentile of one update, with the longest in brackets, in milliseconds.

| | `flowdown` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.20 (3.7) | 0.60 (5.9) | 1.30 (3.5) | 0.30 (2.4) | 0.50 (8.1) | 0.50 (3.0) |
| answer-20k · token | 0.20 (3.6) | 0.70 (11.4) | 4.30 (9.2) | 0.50 (2.5) | 0.70 (8.0) | 0.60 (2.9) |
| table-20k · token | 0.10 (3.8) | 8.50 (12.4) | 6.40 (10.4) | 0.60 (2.1) | 2.20 (8.8) | 0.60 (4.4) |
| code-50k · token | 0.10 (7.5) | 3.40 (116.2) | 1.70 (4.5) | 0.10 (2.8) | 1.00 (8.3) | 0.10 (4.0) |
| long-100k · token | 0.20 (4.4) | 1.30 (43.7) | 8.70 (14.0) | 1.60 (4.2) | 1.90 (28.2) | 2.00 (3.6) |
