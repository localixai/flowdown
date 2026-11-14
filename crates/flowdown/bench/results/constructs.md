| Construct | What is repeated | `flowdown` | `pulldown-cmark` | `pulldown-cmark, kept` | `comrak` |
| --- | --- | ---: | ---: | ---: | ---: |
| words | plain prose | 0.38 | 0.73 | 0.88 | 3.78 |
| paragraphs | a line, a blank line | 0.80 | 1.31 | 1.49 | 5.84 |
| strong | `**word**` | 3.11 | 5.10 | 5.63 | 16.05 |
| emphasis | `*word*` | 3.43 | 5.25 | 5.97 | 17.75 |
| strike | `~~word~~` | 3.22 | 5.31 | 5.88 | 16.39 |
| code | `` `word` `` | 1.18 | 3.45 | 3.92 | 9.50 |
| links | `[word](address)` | 1.58 | 2.95 | 3.31 | 7.62 |
| references | `&amp;` | 1.18 | 4.92 | 5.36 | 23.91 |
| snake_case | an underscore inside a word | 1.28 | 1.52 | 1.70 | 17.17 |
| bare links | `https://…` (only `flowdown` and `comrak` link them) | 0.68 | 0.66 | 0.79 | 11.25 |
| bullets | `- item` | 1.97 | 2.33 | 2.62 | 8.15 |
| ordered | `1. item` | 1.53 | 2.18 | 2.47 | 7.75 |
| tasks | `- [x] item` | 1.76 | 2.16 | 2.51 | 13.54 |
| quote | `> text` | 0.63 | 0.90 | 1.08 | 4.39 |
| headings | `## text` | 2.16 | 3.25 | 3.74 | 14.61 |
| fences | a fenced block of 4 lines | 0.54 | 0.93 | 1.03 | 5.79 |
| table | 400 rows of 3 cells | 2.21 | 3.01 | 3.75 | 18.34 |
| callouts | `> [!NOTE]` and its text | 1.88 | 2.18 | 2.48 | 8.59 |
| steps | `> [!STEPS]` and three steps | 4.73 | 7.60 | 8.66 | 25.88 |

Nanoseconds a byte of text; lower is faster.
