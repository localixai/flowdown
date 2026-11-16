# Benchmark results, in a browser

- **date:** 2026-11-16T04:17:28.426Z
- **commit:** 82bae70
- **dirty:** true
- **cpu:** Apple M5
- **cores:** 10
- **os:** darwin arm64
- **browser:** Chromium 156.0.8078.4
- **runs:** 3
- **perFrame:** 6
- **budgetMs:** 30000
- **renderers:** flowdown 0.6.2, streamdown 2.7.1, react-markdown 10.1.0, markdown-to-jsx 9.10.6, markstream 2.0.24, marked-react 4.0.0

Each renderer streams the reply in Chromium, 6 updates per animation frame. The numbers are
the browser's own counters, the median of 3 runs. Lower is better. "Stopped" means the renderer
spent the time budget (30,000 ms inside its updates) before the reply
ended, and how far it had got.

## Script

Time the main thread spent running script while the reply streamed.

| | `flowdown` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 139 ms | 490 ms | 915 ms | 147 ms | 424 ms | 201 ms |
| answer-20k · token | 298 ms | 2,445 ms | 13,008 ms | 1,669 ms | 2,146 ms | 1,967 ms |
| table-20k · token | 266 ms | 18,531 ms | 15,041 ms | 1,875 ms | 4,312 ms | 1,811 ms |
| code-50k · token | 690 ms | 20,219 ms | 11,265 ms | 837 ms | 6,813 ms | 715 ms |
| long-100k · token | 2,417 ms | 16,989 ms | stopped at 35% | 17,314 ms | 23,914 ms | 24,015 ms |

## The whole main thread

Script, style, layout and paint together: everything that kept the page from answering.

| | `flowdown` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 266 ms | 569 ms | 975 ms | 217 ms | 525 ms | 280 ms |
| answer-20k · token | 789 ms | 2,872 ms | 13,288 ms | 2,058 ms | 2,829 ms | 2,307 ms |
| table-20k · token | 521 ms | 18,911 ms | 15,389 ms | 2,281 ms | 5,002 ms | 2,179 ms |
| code-50k · token | 3,279 ms | 25,263 ms | 14,315 ms | 5,285 ms | 10,382 ms | 4,980 ms |
| long-100k · token | 6,353 ms | 19,005 ms | stopped at 35% | 19,042 ms | 28,066 ms | 25,799 ms |

## One update

The 95th percentile of one update, with the longest in brackets, in milliseconds.

| | `flowdown` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.30 (4.1) | 1.00 (6.4) | 1.30 (3.4) | 0.30 (2.5) | 0.70 (10.3) | 0.40 (2.9) |
| answer-20k · token | 0.20 (4.2) | 1.00 (9.5) | 5.20 (9.2) | 0.80 (3.2) | 0.90 (8.6) | 0.80 (2.9) |
| table-20k · token | 0.20 (4.0) | 9.60 (15.7) | 7.20 (13.2) | 1.00 (2.3) | 2.30 (9.1) | 0.80 (4.7) |
| code-50k · token | 0.20 (7.3) | 3.60 (9.2) | 1.90 (4.1) | 0.20 (2.2) | 1.00 (8.6) | 0.20 (4.2) |
| long-100k · token | 0.30 (9.5) | 1.20 (40.7) | 8.10 (12.5) | 1.40 (3.7) | 2.10 (36.5) | 2.10 (4.5) |
