---
'@localix-ai/flowdown': patch
---

Formulas are set closer to TeX. A subscript on a letter with a tail (`y_i`, `\mu_0`) no longer sits
lower than one on `x`, nor a superscript on a tall letter higher; a name stands a thin space from
the term before it (`y_i \log p_i`); a brace over or under an expression is a brace with its point
in the middle; words over an arrow sit just above it and keep their own width. In a terminal a
leftward arrow under words has its head on the left. `math.css` carries the font with the new
constants.
