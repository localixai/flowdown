| Construct | What is repeated | `flowdown` | `pulldown-cmark` | `pulldown-cmark, kept` | `comrak` |
| --- | --- | ---: | ---: | ---: | ---: |
| words | plain prose | 0.44 | 0.84 | 1.02 | 4.45 |
| paragraphs | a line, a blank line | 0.71 | 1.20 | 1.37 | 5.21 |
| strong | `**word**` | 2.78 | 4.49 | 4.98 | 14.24 |
| emphasis | `*word*` | 3.06 | 4.64 | 5.27 | 16.07 |
| strike | `~~word~~` | 2.88 | 4.62 | 5.21 | 14.24 |
| code | `` `word` `` | 1.13 | 3.49 | 3.86 | 9.31 |
| links | `[word](address)` | 1.52 | 2.92 | 3.24 | 7.37 |
| references | `&amp;` | 1.13 | 4.54 | 5.00 | 23.29 |
| snake_case | an underscore inside a word | 1.17 | 1.40 | 1.58 | 16.56 |
| bare links | `https://…` (only `flowdown` and `comrak` link them) | 0.62 | 0.63 | 0.76 | 10.41 |
| bullets | `- item` | 1.74 | 2.17 | 2.46 | 7.30 |
| ordered | `1. item` | 1.40 | 2.03 | 2.32 | 7.04 |
| tasks | `- [x] item` | 1.63 | 2.00 | 2.28 | 11.98 |
| quote | `> text` | 0.55 | 0.78 | 0.94 | 3.82 |
| headings | `## text` | 1.88 | 2.86 | 3.28 | 12.41 |
| fences | a fenced block of 4 lines | 0.49 | 0.86 | 0.95 | 5.22 |
| table | 400 rows of 3 cells | 2.00 | 2.74 | 3.42 | 17.20 |
| callouts | `> [!NOTE]` and its text | 1.61 | 1.96 | 2.22 | 7.64 |
| steps | `> [!STEPS]` and three steps | 4.27 | 6.92 | 7.80 | 23.12 |

Nanoseconds a byte of text; lower is faster.
