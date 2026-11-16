---
'@localix-ai/flowdown': patch
---

Two flashes of a reply still arriving are gone:

- A last line that is only the marker of a block (`-`, `*`, `+`, `##`, `12.`, `>`, also inside a
  quote, `> -`) is held back until the first word of what it opens. It used to be an empty item,
  heading or quote for a frame; and a `-` under a paragraph made the whole paragraph a heading
  until the item's text came.
- A reply that stops at a line break or a space inside `**bold`, `*italic`, `` `code `` and the
  like is completed where the text ends, before the break. The closing `**` used to go after it,
  where it closes nothing, so the frame showed `**bold` and a stray `**`.

Only frames of a stream change; a finished reply is drawn as before.
