---
'@localix-ai/flowdown': patch
---

Two shapes models write are read as they mean them. A `---` right before the next tab's heading
parts two tabs instead of ending `[!TABS]` after the first, and is not drawn; streaming keeps all
the tabs in one block. A formula may start with a number: `$2 + 2 = 4$` is typeset, while prices
(`$5 and $10`, `pay $5 now and 7$ later`) stay text. A price-looking `$` opens a formula only when
it closes with no other `$` inside and holds a sign only math writes (`= ^ _ \ { } < >`).

A page that numbers or bullets its lists outside the layer flowdown's styles sit in no longer
puts its number or bullet beside the rows of steps, stats, pros and cons, sources and checklists:
each row declares `list-style: none` itself, which wins over the marker it would inherit.
