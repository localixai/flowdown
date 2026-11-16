---
'@localix-ai/flowdown': patch
---

A selection copied from a reply drawn by `<Markdown>`, `@localix-ai/flowdown/dom` or `<flow-down>`
pastes as the reply's own elements, with no class or style. A browser's own copy writes every
computed style inline, so a reply copied from a dark page pasted into a light document as grey
text on white. A word copied from inside bold text is still bold, and a line copied from a code
block is still code. The buttons, icons and labels of code blocks, tabs and trees are left out.
Only absolute web addresses are kept, and a task pastes as `☑` or `☐`. A selection that runs out
of the reply is left to the browser ([styling](https://flowdown.dev/docs/styling#copying-a-reply)).
