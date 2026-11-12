---
'@localix-ai/flowdown': patch
---

Two things assistive technology could not reach or name.

- **A code block that scrolls sideways is a Tab stop**, as a wide table already was: its `<pre>`
  becomes a group named `labels.scrollableCode`, so the arrow keys scroll it (WCAG 2.1.1). A block
  that fits stays out of the Tab order. In `<Markdown>`, `mount()` and `<flow-down>`.
- **A task list's box has a name**: `labels.taskDone` ("Completed task") or `labels.taskOpen`
  ("Incomplete task"). It was announced as "checkbox" alone (WCAG 4.1.2).
- **A box that scrolls is a `group`, not a `region`.** Every wide table of a reply was a landmark
  with the same name, which is what a screen reader's landmark list then filled with. The name and
  the Tab stop are as they were.
