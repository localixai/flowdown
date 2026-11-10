# Specification examples

The examples the engine is held to.

- CommonMark 0.31.2 comes from the `commonmark-spec` package (a dev dependency): 652 examples.
- `gfm-spec.txt` and `gfm-extensions.txt` are GitHub's, copied unchanged from
  [github/cmark-gfm](https://github.com/github/cmark-gfm) `test/` at `27d942c`. The specification
  text is under CC BY-SA 4.0 (John MacFarlane, GitHub); the test files ship with cmark-gfm under
  its BSD 2-Clause license.

`load.ts` reads them; `src/engine/spec.test.ts` runs them; `scripts/conformance.ts` writes
`docs/conformance.md` from the same run.
