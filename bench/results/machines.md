# The same benchmark on every machine

Total main-thread time to stream each reply frame by frame (20 characters an update), from each
machine’s last full run (`bun run bench:all`, three passes). Lower is better; "stopped" means the
renderer used up the 30 s budget first. Absolute times are each machine’s own: compare the
renderers on one row, and the rows for how the order holds. `bun src/machines.ts` writes this
page from the files below.

| Machine | CPU | Run |
| --- | --- | --- |
| quoted in the README | Apple M5, 10 cores, darwin | 2026-11-16, local, 82bae70 |
| linux-2-core | Intel(R) Xeon(R) Processor @ 2.10GHz, 2 cores, linux | 2026-11-21, 0.9.0, 29e9250 |

## chat-5k

| Machine | `flowdown` | `markdown-to-jsx` | `marked-react` | `streamdown` | `markstream` | `react-markdown` | flowdown |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| quoted in the README | 9.4 ms | 15.3 ms | 36.8 ms | 51.2 ms | 41.2 ms | 213 ms | 1.6× faster than markdown-to-jsx |
| linux-2-core | 42.5 ms | 48.8 ms | 140 ms | 262 ms | 239 ms | 829 ms | 1.1× faster than markdown-to-jsx |

## answer-20k

| Machine | `flowdown` | `markdown-to-jsx` | `marked-react` | `streamdown` | `markstream` | `react-markdown` | flowdown |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| quoted in the README | 26.4 ms | 127 ms | 298 ms | 291 ms | 331 ms | 3002 ms | 4.8× faster than markdown-to-jsx |
| linux-2-core | 144 ms | 463 ms | 1307 ms | 1347 ms | 1455 ms | 10903 ms | 3.2× faster than markdown-to-jsx |

## code-50k

| Machine | `flowdown` | `markdown-to-jsx` | `marked-react` | `streamdown` | `markstream` | `react-markdown` | flowdown |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| quoted in the README | 42.2 ms | 62.8 ms | 80.3 ms | 5926 ms | 1076 ms | 3808 ms | 1.5× faster than markdown-to-jsx |
| linux-2-core | 199 ms | 189 ms | 198 ms | 16283 ms | 3166 ms | 9364 ms | 1.1× slower than markdown-to-jsx |

## long-100k

| Machine | `flowdown` | `markdown-to-jsx` | `marked-react` | `streamdown` | `markstream` | `react-markdown` | flowdown |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| quoted in the README | 152 ms | 2393 ms | 7709 ms | 6529 ms | 5714 ms | stopped at 66% | 15.8× faster than markdown-to-jsx |
| linux-2-core | 633 ms | 8901 ms | stopped at 100% | 21434 ms | 22574 ms | stopped at 37% | 14.1× faster than markdown-to-jsx |
