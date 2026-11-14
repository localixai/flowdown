# Specifications

What both of flowdown's parsers are held to: the npm package's (`packages/flowdown`) and the Rust
crate's (`crates/flowdown`). One copy of each file, read by both test suites, so the two never
measure themselves against different texts.

| File | What it is | Who reads it |
| --- | --- | --- |
| `commonmark/spec.txt` | CommonMark 0.31.2, its 652 examples | `packages/flowdown/test/spec/load.ts`, `crates/flowdown/src/testing/spec.rs`, both benches (a long real text) |
| `github/gfm-spec.txt` | GitHub Flavored Markdown's specification; the examples marked with an extension are its extensions | both test suites |
| `github/gfm-extensions.txt` | cmark-gfm's own tests of the extensions | the npm package's |
| `forms/spec.txt` | The dialect's forms (`> [!STEPS]`, `> [!TABS]`, …): the table of their markers, and cases whose expected result is the forms a text holds, as both suites print them | `packages/flowdown/src/forms-spec.test.ts` (with `test/forms.ts`), `crates/flowdown/src/forms_tests.rs` (with `src/testing/spec.rs`) |

An example is a fence of 32 backticks opened with `example` and the extension it is about, the
Markdown, a line holding `.`, then the HTML it reads as; `→` stands for a tab. Each suite numbers
the examples of a file from 1, in order, as the specifications do.

## Where they come from

- `commonmark/spec.txt`: the [CommonMark specification](https://spec.commonmark.org/0.31.2/),
  unchanged, from the `commonmark-spec` package at 0.31.2. The text is under CC BY-SA 4.0 (John
  MacFarlane); `commonmark/LICENSE` is its license.
- `github/gfm-spec.txt` and `github/gfm-extensions.txt`: GitHub's, copied unchanged from
  [github/cmark-gfm](https://github.com/github/cmark-gfm) `test/` at `27d942c`. The specification
  text is under CC BY-SA 4.0 (John MacFarlane, GitHub); the test file ships with cmark-gfm under
  its BSD 2-Clause license.

A file here changes only by copying a newer release whole; both suites then say what moved.
`forms/spec.txt` is ours: a change to the dialect is a change there first, then to both parsers,
in one commit. Each suite also checks its own list of markers against the file's table.
`scripts/conformance.ts` in the package writes `docs/conformance.md` from the npm package's run.
