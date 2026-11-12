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
streaming a 100k-character report token by token in Chromium takes half the script time it did.
