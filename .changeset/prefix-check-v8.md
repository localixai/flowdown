---
'@localix-ai/flowdown': patch
---

A long reply streams faster in Chrome, Edge and Node. Each token, the parts that remember a growing
text first check that the new text continues the last one. That check was `startsWith` on a slice,
which V8 walks a character at a time: seventy microseconds on a 35 KB reply, three times per token.
It is `===` on two slices now, which V8 compares as memory, in one microsecond. Bun and Safari
(JavaScriptCore) were already fast either way, which is why the benchmark, run on Bun, never saw it.

The check for a form's marker that arrived before its content stripped trailing blank space with
`/\s+$/`, which V8 tries at every run of blank space in the reply; it is `trimEnd()` now. Together,
streaming a 100k-character report token by token in Chromium takes a third to a fifth of the script
time it did (7.4 s to 1.4 s on a rested machine, 9.2 s to 2.9 s on a busy one, over 22,000
updates), and a 20k-character answer about half. `bun run browser` in `bench/` measures every
renderer the same way; results are in `bench/results/browser.md`.
