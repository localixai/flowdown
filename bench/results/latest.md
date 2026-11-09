# Benchmark results

- **date:** 2026-11-09T21:07:52.157Z
- **label:** baseline
- **commit:** 466e26f
- **dirty:** true
- **cpu:** Apple M5
- **cores:** 10
- **os:** darwin 25.6.0
- **runtime:** bun 1.4.4
- **runs:** 3
- **quick:** false
- **budgetMs:** 30000
- **renderers:** llx 0.0.0, llx+highlight 0.0.0, streamdown 2.7.1, react-markdown 10.1.0

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(30000 ms) before the reply ended.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` |
| --- | ---: | ---: | ---: | ---: |
| chat-5k · token | 179 ms (0.29) | 190 ms (0.34) | 190 ms (0.30) | 1021 ms (1.85) |
| chat-5k · frame | 39.7 ms (0.29) | 37.4 ms (0.26) | 43.0 ms (0.29) | 227 ms (1.73) |
| answer-20k · token | 653 ms (0.35) | 841 ms (0.52) | 1366 ms (0.59) | 15106 ms (6.54) |
| answer-20k · frame | 146 ms (0.32) | 168 ms (0.44) | 322 ms (0.62) | 3391 ms (6.76) |
| answer-20k · line | 60.6 ms (0.37) | 70.2 ms (0.46) | 114 ms (0.59) | 1079 ms (5.81) |
| forms-20k · frame | 745 ms (1.91) | 762 ms (2.04) | 748 ms (1.39) | 4147 ms (8.16) |
| math-20k · frame | 143 ms (0.37) | 170 ms (0.45) | 371 ms (0.75) | 3269 ms (6.99) |
| code-50k · token | 18720 ms (3.41) | stopped at 49% | stopped at 100% | 16080 ms (2.91) |
| code-50k · frame | 4008 ms (3.17) | stopped at 100% | 10604 ms (10.4) | 6013 ms (5.14) |
| table-20k · frame | 975 ms (8.01) | 884 ms (7.23) | 4745 ms (11.3) | 4220 ms (9.21) |
| long-100k · frame | 1122 ms (0.46) | 1233 ms (0.53) | 7077 ms (2.75) | stopped at 59% |
| crlf-20k · frame | 2866 ms (5.59) | 3151 ms (6.18) | 332 ms (0.64) | 2845 ms (5.08) |
| footnotes-20k · frame | 196 ms (0.39) | 218 ms (0.45) | 386 ms (0.72) | 3581 ms (6.90) |
| thread-30 · frame | 144 ms (0.55) | 132 ms (0.41) | 145 ms (0.65) | 19225 ms (45.9) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` |
| --- | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 1.79 ms | 0 / 0 / 1.87 ms | 0 / 0 / 2.17 ms | 0 / 0 / 3.42 ms |
| chat-5k · frame | 0 / 0 / 1.22 ms | 0 / 0 / 1.10 ms | 0 / 0 / 1.31 ms | 0 / 0 / 2.82 ms |
| answer-20k · token | 0 / 0 / 4.21 ms | 0 / 0 / 3.27 ms | 0 / 0 / 2.98 ms | 2 / 0 / 20.3 ms |
| answer-20k · frame | 0 / 0 / 1.87 ms | 0 / 0 / 1.64 ms | 0 / 0 / 2.32 ms | 0 / 0 / 13.4 ms |
| answer-20k · line | 0 / 0 / 1.29 ms | 0 / 0 / 1.53 ms | 0 / 0 / 2.22 ms | 0 / 0 / 7.35 ms |
| forms-20k · frame | 0 / 0 / 4.83 ms | 0 / 0 / 4.23 ms | 0 / 0 / 2.77 ms | 0 / 0 / 12.5 ms |
| math-20k · frame | 0 / 0 / 1.47 ms | 0 / 0 / 1.96 ms | 0 / 0 / 2.44 ms | 0 / 0 / 12.8 ms |
| code-50k · token | 2 / 0 / 20.5 ms | 54 / 3 / 114 ms | 16 / 4 / 74.6 ms | 10 / 0 / 42.6 ms |
| code-50k · frame | 1 / 0 / 19.4 ms | 613 / 18 / 198 ms | 27 / 2 / 161 ms | 19 / 3 / 295 ms |
| table-20k · frame | 1 / 0 / 17.0 ms | 0 / 0 / 13.2 ms | 2 / 0 / 17.8 ms | 3 / 0 / 34.0 ms |
| long-100k · frame | 0 / 0 / 3.07 ms | 0 / 0 / 2.85 ms | 0 / 0 / 7.78 ms | 507 / 20 / 166 ms |
| crlf-20k · frame | 0 / 0 / 8.43 ms | 0 / 0 / 10.1 ms | 0 / 0 / 2.77 ms | 0 / 0 / 7.22 ms |
| footnotes-20k · frame | 0 / 0 / 9.47 ms | 0 / 0 / 10.1 ms | 0 / 0 / 15.5 ms | 1 / 0 / 18.6 ms |
| thread-30 · frame | 0 / 0 / 3.01 ms | 0 / 0 / 2.79 ms | 0 / 0 / 2.81 ms | 515 / 10 / 74.5 ms |

## Memory

Heap held while the streamed page is mounted / left after it is unmounted, in MB.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` |
| --- | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.9 / 0.6 | 0.8 / 0.2 | 1.0 / 0.7 | 0.6 / 0.5 |
| chat-5k · frame | 0.7 / 0.4 | 0.7 / 0.4 | 0.8 / 0.6 | 0.5 / 0.4 |
| answer-20k · token | 4.1 / 2.6 | 4.9 / 3.5 | 5.9 / 5.1 | 1.5 / 1.0 |
| answer-20k · frame | 3.6 / 2.2 | 4.5 / 3.0 | 5.5 / 4.7 | 3.0 / 2.7 |
| answer-20k · line | 3.1 / 2.1 | 4.0 / 2.9 | 5.4 / 4.6 | 1.6 / 1.2 |
| forms-20k · frame | 8.6 / 6.7 | 10.3 / 8.2 | 10.0 / 8.4 | 2.1 / 1.6 |
| math-20k · frame | 3.7 / 2.2 | 4.7 / 3.3 | 6.9 / 5.8 | 2.6 / 2.1 |
| code-50k · token | 1.0 / 0.8 | 8.0 / 0.7 | 23.2 / 0.7 | 0.8 / 0.7 |
| code-50k · frame | 1.3 / 0.5 | 15.8 / 14.5 | 10.4 / 9.6 | 0.2 / 0.2 |
| table-20k · frame | 4.3 / 2.5 | 4.6 / 3.3 | 6.9 / 5.4 | 3.3 / 2.5 |
| long-100k · frame | 23.9 / 9.4 | 28.2 / 13.7 | 27.2 / 22.8 | 4.4 / 0.0 |
| crlf-20k · frame | 2.5 / 1.8 | 2.8 / 2.1 | 5.7 / 4.8 | 1.4 / 1.1 |
| footnotes-20k · frame | 2.9 / 2.1 | 4.1 / 3.3 | 5.7 / 4.9 | 2.0 / 1.6 |
| thread-30 · frame | 13.0 / 9.7 | 18.0 / 14.6 | 28.7 / 23.8 | 8.6 / 6.4 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `llx` | 64.1 ms | 724 ms | 11.3× (n^1.75) |
| `llx+highlight` | 58.6 ms | 601 ms | 10.2× (n^1.68) |
| `streamdown` | 129 ms | 1164 ms | 9.0× (n^1.59) |
| `react-markdown` | 1143 ms | 15870 ms | 13.9× (n^1.90) |
