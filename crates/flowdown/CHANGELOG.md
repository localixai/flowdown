# Changelog

The Rust crate `flowdown`. Its versions are its own, apart from the npm package's: a tag
`rust-v<version>` releases one. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the crate follows
[Semantic Versioning](https://semver.org/).

## Unreleased

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
