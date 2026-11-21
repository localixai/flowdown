# Changelog

The Rust crate `flowdown`. Its versions are its own, apart from the npm package's: a tag
`rust-v<version>` releases one. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the crate follows
[Semantic Versioning](https://semver.org/).

## Unreleased

## 0.1.2

### Fixed

- A wide table no longer asks for room for millions of nodes, and a long one no longer stops the
  program. A row's cells are made before their text is read, and the room for the nodes still to
  come was reckoned from them as if the text had made them: 500 columns over 20 KB asked room for
  12 million nodes, and a 112 KB table with rows short of its columns (`bench/`'s worst texts, at
  sixteen times) for 69 GB, which aborts. The cells now count as the block pass's own, each cell's
  inlines are reckoned from where it is in its row, the guess is held to two nodes a byte still to
  read, and the product is saturated so it cannot wrap where `usize` is 32 bits (R1, R7). That
  table grows 3.9 times at four times its length, where it grew 8.5.

## 0.1.1

### Changed

- A `---` right before a heading of the tabs' level parts two tabs instead of ending `[!TABS]`,
  and is dropped: models write one between variants (`spec/forms/spec.txt`).
- A formula may start with a number: `$2 + 2 = 4$` is one. A price-looking `$` opens a formula
  only when it closes with no other `$` inside and holds `=`, `^`, `_`, `\`, `{`, `}`, `<` or `>`,
  so `$5 and $10` and `pay $5 now and 7$ later` stay text.
- The crate's homepage is https://flowdown.localix.ai; flowdown.dev redirects there.
- `prompt()`'s first rule says the reader sees the forms drawn, not that the page renders them:
  the text teaches a model whatever draws its reply, a terminal among them.

### Fixed

Four readings the npm package's differential fuzz found (`bench/src/differential.ts`), where
micromark and markdown-it agree with each other, fixed in both parsers:

- A blank line after indented code in a list item makes the list loose: the code's trailing blank
  lines were counted as its own lines, and the gap after them was not seen.
- A link reference definition is a block of its list item, so a blank line before it makes the
  list loose (CommonMark's example 317 counts it so).
- A list item that can interrupt a paragraph is read before a table's row of dashes: `b\n- |` is a
  paragraph and a list, as GitHub's parser reads it, not a table.
- A header that is a pipe alone heads no table.

## 0.1.0

The crate's first version in this repository, as it left Localix CLI's `packages/markdown`.

### Added

- `parse` and `parse_as`: any text read into a `Document`, as CommonMark, as GitHub's dialect or
  as an agent's reply with its forms (callouts, steps, tabs, figures, the case for and against,
  folded sections, sources) and formulas. Nothing fails, and a reply cut mid-stream reads as far
  as it goes.
- `Node`, a place in the tree, and `Kind`, matched exhaustively.
- `prompt`: the text that teaches a model to write the forms, the npm package's own.

### Changed since Localix CLI's copy

- Unicode's punctuation is Unicode 17's, the table the npm package's parser reads (it was
  Unicode 13's): emphasis next to a character added since is delimited as both parsers agree.
- `prompt()` returns the npm package's section, formulas taught, in place of Localix CLI's own.
- A bare address lets go of a `;` at its end, as cmark-gfm and the npm package do: it kept one
  that ended no character reference (`spec/github/bare-links.txt`).

### Fixed since Localix CLI's copy

- A bare address followed by a long run of `)` took time that grew with the square of the run
  (160 KB of them, 3 s): the brackets were counted again for each `)` let go. They are counted
  once, and only when a `)` ends the address (R7). The bench's `worst` measures the case.
