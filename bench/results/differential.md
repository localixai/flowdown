# Differential fuzz

flowdown's engine against micromark with GFM, the reference implementation, on seeded random
documents. `bun run differential` in bench/ writes this file; [src/differential.ts](../src/differential.ts)
says how documents are made, normalized, minimized and grouped, and holds the verdicts below
(`KNOWN`). It exits non-zero on a family no verdict covers.

- flowdown: `toHtml(parse(md), { tagFilter: true })`, GFM on, no dialect extension, every HTML5
  entity loaded.
- micromark 4.0.3 with micromark-extension-gfm 3.0.0: `allowDangerousHtml` and
  `allowDangerousProtocol`, so both pass raw HTML and every link through. No footnotes are
  generated: the two write different footnote markup by design.
- markdown-it 15 (`html: true`) is shown as a third reading. It has tables but no task lists and
  no bare links as set up, so it settles CommonMark questions only.

- **date:** 2026-11-16T00:13:50.607Z
- **commit:** 82bae70 (with uncommitted changes under packages/flowdown/src)
- **cpu:** Apple M5, 10 cores, darwin 25.6.0
- **runtime:** bun 1.4.4
- **documents:** 50000, 12.5 MB, seed 1
- **time:** 93.2 s, minimizing included
- **differ:** 18269 (36.5%), in 117 classes and 19 families; 0 families not judged; 0 crashed

## How a difference is named

A rewrite names it when one output, rewritten so, is the other. An ablation names it when the
text with one construct defused (bare-link triggers, a tab, a task marker, a pipe, a fence, a
backtick, `<`, `&`, `\`, `>`) draws alike in both. Otherwise its signature is the element open
where the outputs part and the token each side writes there (`flowdown | micromark`), read after
the commonest judged causes are defused. Families gather classes of one cause.

## Families

| Family | Documents | Follows the spec |
| --- | ---: | --- |
| indented code split in two | 3700 | flowdown |
| bare link | 2960 | flowdown |
| code at the end of a container | 2358 | mixed |
| tab after a task marker | 1607 | flowdown |
| blank lines in a list item (tight or loose) | 1558 | mixed |
| empty list item after another block | 1438 | flowdown |
| tab before a line ending | 1238 | flowdown |
| task marker in a loose item | 1195 | flowdown |
| several of the above | 716 | mixed |
| table without a pipe | 375 | unsettled |
| HTML | 332 | flowdown |
| line endings only | 283 | flowdown |
| code span across an indented line | 173 | unsettled |
| text after raw HTML, in documents with more than one cause | 166 | mixed |
| table where a list item or paragraph comes first | 78 | micromark |
| link reference definition in a list item | 73 | mixed |
| task marker with nothing after it | 11 | unsettled |
| rare ablations | 5 | mixed |
| emphasis and the rule of three | 3 | flowdown |

### indented code split in two

3700 documents. **Follows the spec:** flowdown.

After a container closes (an empty quote, an empty item), micromark ends an indented code block at every line and starts another (`>\n    a\n    b` gives two blocks), or at a blank line inside it. CommonMark 4.4 makes one block of consecutive indented chunks; markdown-it agrees with flowdown.

Minimal repro, as a JSON string:

```
">\n    >\n    >"
```

flowdown, micromark, markdown-it (normalized):

```
"<blockquote></blockquote><pre><code>&gt;\n&gt;\n</code></pre>"
"<blockquote></blockquote><pre><code>&gt;\n</code></pre><pre><code>&gt;\n</code></pre>"
"<blockquote></blockquote>"
```

### bare link

2960 documents. **Follows the spec:** flowdown.

GFM bare links (`www.`, `http://`, `a@b.c`). cmark-gfm finds them in text nodes after emphasis and links are read, so `http://a*x*` is a link and then `<em>x</em>`; the engine does the same (spec/github/bare-links.txt is its record of cmark-gfm's ends). micromark reads them as it tokenizes, before emphasis, and leaves none after an open `[` or a raw tag. `a@b.1` is an email by the letter of the GFM spec (a period, no `-` or `_` last); micromark refuses a digit-only last label.

Minimal repro, as a JSON string:

```
"http://a*x*"
```

flowdown, micromark, markdown-it (normalized):

```
"<p><a href=\"http://a\">http://a</a><em>x</em></p>"
"<p><a href=\"http://a*x\">http://a*x</a>*</p>"
"<p>http://a<em>x</em></p>"
```

### code at the end of a container

2358 documents. **Follows the spec:** mixed.

Mostly micromark. Most `code: text | text` documents are its indented-code split where a blank or whitespace-only line sits at the split, which the rewrite does not undo. An unclosed fence that ends with its container gets an extra blank line (`>```\n>c\n*`), and an indented block keeps a trailing whitespace-only line (`    *\n\t `), which CommonMark 4.4 leaves out; markdown-it agrees with flowdown. Unsettled: an unclosed fence in an item ended by a line of spaces (`1. ```\n    `): flowdown writes `\n`, micromark ` \n`, markdown-it nothing. The fenced-code ablation also takes the code-span case below when a fence opener is read as a code span.

Classes: `code: text | text` (1666), `fenced code, among others` (268), `fenced code` (207), `code: </code> | text` (198), `pre: text | text` (17), `pre: </blockquote> | text` (2).

Minimal repro, as a JSON string:

````
"*\n  ```\n   "
````

flowdown, micromark, markdown-it (normalized):

```
"<ul><li><pre><code></code></pre></li></ul>"
"<ul><li><pre><code> \n</code></pre></li></ul>"
"<ul><li><pre><code></code></pre></li></ul>"
```

### tab after a task marker

1607 documents. **Follows the spec:** flowdown.

cmark-gfm takes the whitespace after `[ ]` with the marker and writes the checkbox followed by one space, as the engine does (`<input …> a`); micromark keeps the tab. GFM spec examples only use a space, so this is cmark-gfm behaviour, not spec text.

Minimal repro, as a JSON string:

```
"- [ ]\t."
```

flowdown, micromark, markdown-it (normalized):

```
"<ul><li><input disabled=\"\" type=\"checkbox\"> .</li></ul>"
"<ul><li><input disabled=\"\" type=\"checkbox\">\t.</li></ul>"
"<ul><li>[ ]\t.</li></ul>"
```

### blank lines in a list item (tight or loose)

1558 documents. **Follows the spec:** mixed.

Two causes. (1) flowdown bug: an item whose indented code block is followed by a blank line and more content (`-     c\n\n  x`) is loose, but flowdown draws it tight. Suspect: `finalize`'s `code` case in engine/blocks.ts strips the trailing blank lines from the text but leaves `endLine` on the blank line, so `gapAfter` sees no gap. micromark and markdown-it agree. (2) micromark bug: blank `>` lines after a list inside a quote make micromark draw it loose (`>- a\n>\n>`); a blank line ending the last item does not loosen a list (CommonMark 5.3), and markdown-it agrees with flowdown. The `blockquote` ablation, which defuses every `>`, also takes some micromark code splits.

Classes: `blockquote` (1023), `li: text | <p>` (292), `li: <input> | <p>` (150), `li: <p> | text` (51), `li: <a> | <p>` (18), `li: <p> | <a>` (5), `li: <img> | <p>` (4), `li: <strong> | <p>` (3), `li: <em> | <p>` (2), `li: <x> | <p>` (2), `li: <p> | <em>` (2), `li: </span> | <p>` (1), `li: <del> | <p>` (1), `li: <p> | <strong>` (1), `li: <p> | <x>` (1), `li: <h1> | <p>` (1), `li: </a> | <p>` (1).

Minimal repro, as a JSON string:

```
">~~~\n>~~~\n>- [\n>\n>"
```

flowdown, micromark, markdown-it (normalized):

```
"<blockquote><pre><code></code></pre><ul><li>[</li></ul></blockquote>"
"<blockquote><pre><code></code></pre><ul><li><p>[</p></li></ul></blockquote>"
"<blockquote><pre><code></code></pre><ul><li>[</li></ul></blockquote>"
```

### empty list item after another block

1438 documents. **Follows the spec:** flowdown.

An empty list item (`0.`, `-`) or an ordered one not starting at 1, right after an indented code block, or as the first line of a new quote or item. CommonMark 5.2 forbids only that such an item interrupt a paragraph; none is open here. micromark keeps its "interrupting" state across the closed block and reads text. markdown-it agrees with flowdown.

Classes: `blockquote: <ol> | <p>` (478), `root: <ol> | <p>` (404), `li: <ol> | <p>` (248), `li: <ol> | text` (122), `empty list item` (83), `empty list item, among others` (49), `blockquote: <ul> | <p>` (11), `div: <ol> | <p>` (9), `li: <ol> | <h2>` (6), `li: <ul> | <p>` (5), `a: <ol> | <p>` (5), `blockquote: <ol> | <h2>` (3), `li: <ul> | text` (3), `td: <ol> | <p>` (3), `li: <ol> | <h1>` (2), `root: <ul> | <p>` (1), `root: <ol> | <h1>` (1), `b: <ol> | <p>` (1), `span: <ol> | <p>` (1), `x: <ol> | <p>` (1), `blockquote: <ol> | <h1>` (1), `details: <ol> | <p>` (1).

Minimal repro, as a JSON string:

```
"[\n>*"
```

flowdown, micromark, markdown-it (normalized):

```
"<p>[</p><blockquote><ul><li></li></ul></blockquote>"
"<p>[</p><blockquote><p>*</p></blockquote>"
"<p>[</p><blockquote><ul><li></li></ul></blockquote>"
```

### tab before a line ending

1238 documents. **Follows the spec:** flowdown.

A tab before a soft line break. CommonMark 6.13 says "Spaces at the end of the line … are removed", naming spaces only; commonmark.js and markdown-it keep the tab, as flowdown does. cmark and micromark strip any whitespace. Not a bug on either side; it only shows as whitespace in the HTML.

Minimal repro, as a JSON string:

```
"b\t\n<"
```

flowdown, micromark, markdown-it (normalized):

```
"<p>b\t\n&lt;</p>"
"<p>b\n&lt;</p>"
"<p>b\t\n&lt;</p>"
```

### task marker in a loose item

1195 documents. **Follows the spec:** flowdown.

In a loose item cmark-gfm's task-list renderer writes the checkbox right after `<li>`, before the `<p>`, as the engine does; micromark puts it inside the paragraph. The GFM spec has no loose task-list example, so this is cmark-gfm behaviour (from its tasklist.c renderer, not run here).

Classes: `task marker` (747), `task marker, among others` (448).

Minimal repro, as a JSON string:

```
">- [ ]\n>\n>"
```

flowdown, micromark, markdown-it (normalized):

```
"<blockquote><ul><li><input disabled=\"\" type=\"checkbox\"> </li></ul></blockquote>"
"<blockquote><ul><li><p>[ ]</p></li></ul></blockquote>"
"<blockquote><ul><li>[ ]</li></ul></blockquote>"
```

### several of the above

716 documents. **Follows the spec:** mixed.

Documents that differ in more than one judged family at once and in nothing else, mostly the two tab families together (which the `tab` ablation, defusing every tab, takes as one).

Classes: `several of the above` (564), `tab` (152).

Minimal repro, as a JSON string:

```
">[l]b\t\n>a | b word —__\n- [ ]\t[l][r]__ ](\n"
```

flowdown, micromark, markdown-it (normalized):

```
"<blockquote><p>[l]b\t\na | b word —__</p></blockquote><ul><li><input disabled=\"\" type=\"checkbox\"> [l][r]__ ](</li></ul>"
"<blockquote><p>[l]b\na | b word —__</p></blockquote><ul><li><input disabled=\"\" type=\"checkbox\">\t[l][r]__ ](</li></ul>"
"<blockquote><p>[l]b\t\na | b word —__</p></blockquote><ul><li>[ ]\t[l][r]__ ](</li></ul>"
```

### table without a pipe

375 documents. **Follows the spec:** unsettled.

A one-column table with no pipe: `a\n:-`. micromark makes a table; flowdown and markdown-it keep a paragraph (the engine asks for a `|` in `parseDelimiterRow`, engine/blocks.ts). GFM 4.10's text and examples always have a pipe, but its delimiter grammar does not require one, and micromark follows github.com here as far as its author tested. Not settled without cmark-gfm.

Classes: `table without a pipe` (250), `table without a pipe, among others` (64), `root: <p> | <table>` (27), `blockquote: <p> | <table>` (24), `li: <p> | <table>` (8), `li: text | <table>` (2).

Minimal repro, as a JSON string:

```
"e\n:-"
```

flowdown, micromark, markdown-it (normalized):

```
"<p>e\n:-</p>"
"<table><thead><tr><th align=\"left\">e</th></tr></thead></table>"
"<p>e\n:-</p>"
```

### HTML

332 documents. **Follows the spec:** flowdown.

micromark bugs: a lazy line after a raw-HTML line ends the paragraph (`- a\n<x>\n`b` ends the item after `<x>`); a type-7 tag line after a paragraph line with `|` ends the paragraph (micromark-extension-gfm-table's interrupt state); `<script` at the end of the input escapes the tag filter. markdown-it agrees with flowdown on the CommonMark ones.

Classes: `HTML` (263), `li: <x> | text` (12), `li: <em> | text` (6), `li: <a> | text` (6), `p: <em> | text` (5), `p: </p> | text` (4), `blockquote: </blockquote> | text` (3), `li: </pre> | text` (3), `li: <strong> | <table>` (2), `p: <br> | text` (2), `p: <a> | text` (2), `li: <input> | text` (2), `a: <br> | text` (2), `p: <x> | </p>` (2), `li: <br> | <b>` (1), `li: <a> | <table>` (1), `h2: <em> | text` (1), `li: <b> | text` (1), `li: <table> | <a>` (1), `p: </a> | </p>` (1), `p: <strong> | </p>` (1), `b: <a> | </p>` (1), `x: </a> | </li>` (1), `p: <a> | </p>` (1), `a: </a> | </p>` (1), `p: <br> | </p>` (1), `p: <span> | </p>` (1), `em: </em> | text` (1), `x: <a> | </li>` (1), `li: <em> | <table>` (1), `h1: <em> | text` (1), `a: <em> | </li>` (1).

Minimal repro, as a JSON string:

```
">|\n<a>"
```

flowdown, micromark, markdown-it (normalized):

```
"<blockquote><p>|\n<a></p></blockquote>"
"<blockquote><p>|</p></blockquote><a>"
"<blockquote><p>|\n<a></p></blockquote>"
```

### line endings only

283 documents. **Follows the spec:** flowdown.

The outputs differ in line endings and the indentation after them. micromark drops the line endings of an HTML block after a link reference definition (`[r]: /u\n<pre>\n  x\n</pre>` gives `<pre>  x</pre>`) and inside some containers, and keeps the indentation of a lazy line; markdown-it agrees with flowdown. Nothing a browser draws differently outside `<pre>`.

Minimal repro, as a JSON string:

```
"- b\n  <!--\n  f"
```

flowdown, micromark, markdown-it (normalized):

```
"<ul><li>b\n<!--\nf</li></ul>"
"<ul><li>b\n<!--f</li></ul>"
"<ul><li>b<!--\nf</li></ul>"
```

### code span across an indented line

173 documents. **Follows the spec:** unsettled.

A code span whose second line is indented: `` `\n ` ``. flowdown drops the indentation (`<code> </code>`); micromark, markdown-it and cmark keep it (`<code>  </code>`). CommonMark 4.8 says a paragraph's raw content is its lines with initial spaces or tabs removed, which is flowdown's reading, and commonmark.js advances past it the same way, but the other reference implementations do not. The engine strips it in `incorporateLine` (`advanceNextNonspace` when no block starts), engine/blocks.ts.

Classes: `code span` (125), `code span, among others` (48).

Minimal repro, as a JSON string:

```
"`\n `"
```

flowdown, micromark, markdown-it (normalized):

```
"<p><code> </code></p>"
"<p><code>  </code></p>"
"<p><code>  </code></p>"
```

### text after raw HTML, in documents with more than one cause

166 documents. **Follows the spec:** mixed.

Long documents that differ in more than one way, the first difference inside text, so no one ablation names it and the signature says little. Every sample read was a micromark family above: a lazy line after a raw-HTML line, a line ending dropped in an HTML block, `</textarea>` (not an HTML block start, CommonMark 4.6) ending a paragraph, or the empty-item interrupt.

Classes: `p: text | text` (59), `li: text | text` (39), `p: text | </p>` (16), `div: text | text` (9), `a: text | </li>` (8), `blockquote: text | text` (7), `x: text | </li>` (7), `a: text | text` (5), `span: text | </li>` (5), `span: text | text` (3), `root: text | text` (3), `b: text | text` (2), `x: text | text` (2), `u: text | text` (1).

Minimal repro, as a JSON string:

```
"1.     \n   ß<?p \nhttp://a.b/*x* \n<span>\n =\n"
```

flowdown, micromark, markdown-it (normalized):

```
"<ol><li>ß&lt;?p\n<a href=\"http://a.b/\">http://a.b/</a><em>x</em><span>\n=</li></ol>"
"<ol><li>ß&lt;?p\n<a href=\"http://a.b/*x\">http://a.b/*x</a>*\n<span></li></ol><p>=</p>"
"<ol><li>ß&lt;?p\nhttp://a.b/<em>x</em><span>\n=</li></ol>"
```

### table where a list item or paragraph comes first

78 documents. **Follows the spec:** micromark.

flowdown bug. (1) `a | b\n- | -`: the second line is a list item (`- ` then text), and cmark-gfm tries an extension's block (the table) only after every core block start, so the list item wins; the engine tries the table delimiter row first, in `startBlock` (engine/blocks.ts, the `container.type === "paragraph"` branch before the list-marker branch). (2) `|\n-|`: a header of a lone pipe has no cell, so it cannot match one delimiter cell; `splitRow` counts one empty cell for it (the `line === ""` case). micromark and markdown-it agree.

Classes: `table, among others` (40), `table` (34), `li: <table> | text` (4).

Minimal repro, as a JSON string:

```
"[\n    *\n|-"
```

flowdown, micromark, markdown-it (normalized):

```
"<p>[</p><table><thead><tr><th>*</th></tr></thead></table>"
"<p>[\n*\n|-</p>"
"<p>[\n*\n|-</p>"
```

### link reference definition in a list item

73 documents. **Follows the spec:** mixed.

Mostly a flowdown bug: `- a\n\n  [r]: /u` is loose, as the definition is a block with a blank line before it (CommonMark 5.3, and example 317 counts it so); micromark and markdown-it draw `<p>a</p>`. The engine's `finalize` removes the emptied paragraph before the list is judged, so `gapAfter` never sees it (engine/blocks.ts, `paragraph` and `list` cases). Also one micromark bug: after a definition, `*     c\n      m` joins two code lines as `cm`.

Classes: `link reference definition, among others` (46), `link reference definition` (27).

Minimal repro, as a JSON string:

```
">[R][\n2) [r]:/"
```

flowdown, micromark, markdown-it (normalized):

```
"<blockquote><p><a href=\"/\">R</a>[</p></blockquote><ol start=\"2\"><li></li></ol>"
"<blockquote><p>[R][</p></blockquote><ol start=\"2\"><li></li></ol>"
"<blockquote><p><a href=\"/\">R</a>[</p></blockquote><ol start=\"2\"><li></li></ol>"
```

### task marker with nothing after it

11 documents. **Follows the spec:** unsettled.

`- [ ]` with nothing after it. flowdown draws an empty checkbox; micromark and markdown-it draw the text `[ ]`. GFM 5.3 asks for "at least one whitespace character" after the marker before other content and says nothing of no content; cmark-gfm's scanner counts the line's newline as that whitespace (not checked here). Suspect: `reTaskMarker` in engine/blocks.ts, whose lookahead takes `\n`.

Classes: `task marker with nothing after it` (10), `task marker with nothing after it, among others` (1).

Minimal repro, as a JSON string:

```
"- [ ]"
```

flowdown, micromark, markdown-it (normalized):

```
"<ul><li><input disabled=\"\" type=\"checkbox\"> </li></ul>"
"<ul><li>[ ]</li></ul>"
"<ul><li>[ ]</li></ul>"
```

### rare ablations

5 documents. **Follows the spec:** mixed.

Defusing every `&` or `\` happened to remove the difference. The samples read were families above: the indented-code loose item (flowdown bug) and the code span across an indented line.

Classes: `backslash escape` (5).

Minimal repro, as a JSON string:

```
"&|\\||a\n-|-|-|-\n- 1."
```

flowdown, micromark, markdown-it (normalized):

```
"<p>&amp;|||a\n-|-|-|-</p><ul><li><ol><li></li></ol></li></ul>"
"<p>&amp;|||a\n-|-|-|-</p><ul><li>1.</li></ul>"
"<p>&amp;|||a\n-|-|-|-</p><ul><li><ol><li></li></ol></li></ul>"
```

### emphasis and the rule of three

3 documents. **Follows the spec:** flowdown.

`**]* f*b`. After `<em>]</em>` takes one `*` of the opening `**`, micromark matches the one left with the `*` of `f*b`. CommonMark 6.2 rule 9 forbids it: the closer can open and close, and the lengths of the delimiter runs (2 and 1, as written) add up to 3. micromark checks the lengths left over instead.

Classes: `p: text | <em>` (3).

Minimal repro, as a JSON string:

```
"**]* f*b"
```

flowdown, micromark, markdown-it (normalized):

```
"<p>*<em>]</em> f*b</p>"
"<p><em><em>]</em> f</em>b</p>"
"<p>*<em>]</em> f*b</p>"
```
