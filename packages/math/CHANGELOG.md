# @localix-ai/math

## 0.1.1

- **Scripts sit where TeX sets them.** A subscript on a letter with a tail (`y_i`, `p_i`, `\mu_0`)
  sat lower than one on `x`, and a superscript on a tall letter (`\theta^2`, `b^2`) higher: the
  math font's own constants are now TeX's, so a script on a single letter sits where `x`'s does.
- **A name stands a thin space from the term before it**: `y_i \log p_i`, `x^2 \sin y`, on a page
  and in a terminal, as `n \log n` already did.
- **A brace over or under an expression is a brace**, with its point in the middle, where it was a
  bracket with rounded ends.
- **Words over an arrow sit just above it** (`\xrightarrow{f}`), where they floated 0.8 em up, and
  long words keep their own width instead of running over the next symbol.
- In a terminal, a leftward arrow under words (`\xleftarrow`) has its head on the left.

## 0.1.0

- **First version.** TeX as agents write it, read by one parser into MathML Core for a page (with
  STIX Two Math cut to what replies use) and into Unicode for a terminal, on one line (`toText`) or
  on rows (`toRows`). Reads any text and never throws; every prefix of a stream draws.
