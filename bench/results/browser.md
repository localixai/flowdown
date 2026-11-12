# Benchmark results, in a browser

- **date:** 2026-11-12T15:35:51.991Z
- **commit:** 702280f
- **dirty:** true
- **cpu:** Apple M5
- **cores:** 10
- **os:** darwin arm64
- **browser:** Chromium 156.0.8078.4
- **runs:** 3
- **perFrame:** 6
- **budgetMs:** 30000
- **renderers:** flowdown 0.5.0, streamdown 2.7.1, react-markdown 10.1.0, markdown-to-jsx 9.10.6, markstream 2.0.24, marked-react 4.0.0

Each renderer streams the reply in Chromium, 6 updates per animation frame. The numbers are
the browser's own counters, the median of 3 runs. Lower is better. "Stopped" means the renderer
spent the time budget (30,000 ms inside its updates) before the reply
ended, and how far it had got.

## Script

Time the main thread spent running script while the reply streamed.

| | `flowdown` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 135 ms | 474 ms | 996 ms | 208 ms | 490 ms | 382 ms |
| answer-20k · token | 411 ms | 2,275 ms | 10,892 ms | 1,276 ms | 1,877 ms | 1,626 ms |
| table-20k · token | 349 ms | 16,157 ms | 12,687 ms | 2,130 ms | 4,017 ms | 2,296 ms |
| code-50k · token | 647 ms | 18,754 ms | 10,359 ms | 697 ms | 6,613 ms | 527 ms |
| long-100k · token | 2,917 ms | 19,162 ms | stopped at 37% | 18,153 ms | 24,069 ms | 23,789 ms |

## The whole main thread

Script, style, layout and paint together: everything that kept the page from answering.

| | `flowdown` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 287 ms | 556 ms | 1,060 ms | 327 ms | 631 ms | 491 ms |
| answer-20k · token | 977 ms | 2,611 ms | 11,132 ms | 1,604 ms | 2,538 ms | 1,979 ms |
| table-20k · token | 700 ms | 16,491 ms | 12,962 ms | 2,482 ms | 4,526 ms | 2,650 ms |
| code-50k · token | 3,113 ms | 23,387 ms | 13,061 ms | 4,543 ms | 10,202 ms | 3,864 ms |
| long-100k · token | 7,731 ms | 20,875 ms | stopped at 37% | 19,813 ms | 28,126 ms | 25,461 ms |

## One update

The 95th percentile of one update, with the longest in brackets, in milliseconds.

| | `flowdown` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.30 (3.5) | 0.90 (7.2) | 1.40 (3.3) | 0.50 (2.4) | 1.10 (8.1) | 0.70 (2.7) |
| answer-20k · token | 0.30 (5.2) | 0.90 (13.6) | 4.30 (9.8) | 0.60 (2.4) | 0.90 (8.7) | 0.60 (2.8) |
| table-20k · token | 0.20 (3.4) | 8.20 (11.7) | 6.00 (8.7) | 0.80 (2.1) | 1.70 (8.2) | 0.90 (4.0) |
| code-50k · token | 0.20 (5.1) | 3.10 (8.4) | 1.60 (3.7) | 0.20 (2.1) | 1.00 (8.1) | 0.10 (4.2) |
| long-100k · token | 0.30 (10.5) | 1.30 (40.4) | 7.70 (11.5) | 1.40 (3.9) | 1.80 (16.1) | 1.90 (3.4) |
