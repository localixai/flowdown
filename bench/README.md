# Benchmark

How much main-thread work it costs to stream a model's reply into the page, measured the same
way for flowdown and for the renderers it is compared with. This is the number the library
is held to: [`budgets.json`](budgets.json) states the targets, `bun run bench:check` fails when a
run misses one, and every full run is committed under [`results/`](results/).

The latest numbers: [`results/latest.md`](results/latest.md).

## What is measured

A reply is handed to the renderer the way a chat page hands it: every growing prefix, one update
at a time, then the finished text with `streaming` off. Each update is timed from
`root.render()` until React's scheduler is idle again: the commit (`flushSync`), then the effects
it queued and the renders they cause, as the page's event loop would run them before the next
token. That is healing the unfinished Markdown, splitting, parsing, React and the DOM writes: the
work a token costs the main thread before the browser can paint or answer a key press. Waiting
for the scheduler matters. A loop that never yields lets effects pile up as queued tasks (heap
that looks leaked), makes a renderer that sets state from an effect hit React's nested-update
limit, and never delivers code loaded on demand, such as Streamdown's code block, so its fallback
would be measured instead ([`src/idle.ts`](src/idle.ts)). Layout and paint belong to the browser and
are the same for every renderer, so they are left out.

For each scenario, renderer and chunk pattern the run records:

| Column | Meaning |
| --- | --- |
| total | The sum of all updates: the whole stream's main-thread time. |
| p50, p95, p99, max | One update, at those percentiles. |
| over frame | Updates longer than 16.7 ms: each one drops a frame at 60 Hz. |
| over long task | Updates longer than 50 ms: the page stops answering input. |
| mount, finish | The first render, and the render of the finished reply. |
| cpu | Process CPU time over the run. If it is far above `total`, the renderer defers work to timers that `total` does not see. |
| live, kept, grown | Heap growth while the page is mounted; what stays after it unmounts the first time (caches the reply warmed, which are bounded); and what a second stream of the same reply adds, the median over the repeats (a leak shows in every one). |
| nodes | DOM elements of the finished page. |

Each measurement is warmed up on its first 200 updates, then run three times; the median is kept. A renderer
that uses up the 30-second budget on a scenario is stopped, and the table says how far it got.

The three runs of a measurement follow each other within seconds, so a burst of other work on the
machine can slow all three, and a stream that takes 30 ms shows it most. `--passes=3` measures the
whole table three times over and keeps, for each number, the median of its three passes: the passes
are minutes apart, and a burst reaches one of them. The results in git are measured this way.

## Scenarios

The replies are generated from fixed seeds by
[`packages/flowdown/test/replies.ts`](../packages/flowdown/test/replies.ts): the same text
on every run and every machine, and the run records each one's hash. The package's own tests
stream the same replies, so a speed-up that changes what is drawn fails there first.

| Scenario | What it is |
| --- | --- |
| `chat-5k` | A short chat answer: prose and lists. |
| `answer-20k` | A typical agent answer: prose, lists, code, tables, callouts. |
| `forms-20k` | Dense dialect: steps, tabs, stats, pros and cons, file trees. |
| `math-20k` | Prose with formulas and literal dollars. |
| `code-50k` | Mostly code fences. |
| `table-20k` | Wide tables. |
| `long-100k` | A long report. |
| `crlf-20k` | Windows line endings. |
| `footnotes-20k` | Footnotes, which resolve across the whole document. |
| `thread-30` | The last reply of a 30-message thread, with the 29 before it on the page. |
| `answer-10k`, `answer-40k` | The same reply at two sizes, four times apart, for scaling. |

Chunk patterns ([`test/chunks.ts`](../packages/flowdown/test/chunks.ts)):

- `frame`: 20 characters per update, what a host that batches per animation frame passes. This is
  the pattern markstream's benchmarks use (20-character chunks at 30 Hz), and every scenario runs
  under it.
- `token`: 1 to 12 characters, what an LLM API streams. The hot paths run under it too.
- `line`: a host that flushes on newlines.

## References

Two kinds of yardstick, both in `budgets.json`.

**Other renderers**, configured the way their own READMEs tell a chat to use them, with no
highlighter, math or diagrams, so each parses the same Markdown:

- **Streamdown** (Vercel): the closest match, a streaming renderer for AI replies built on
  react-markdown with block memoization and its own healing (`remend`). The bar flowdown has
  to clear: `reference` allows at most 25% more total time.
- **react-markdown** with remark-gfm: what most pages use, and what flowdown and Streamdown
  are built on. It reparses the whole reply on every token, which is the cost the other two
  exist to avoid.
- **markstream-react**: a streaming renderer whose published benchmark this methodology follows.

**The browser's thresholds**, which hold whatever the other renderers do:

- **A frame, 16.7 ms.** At 60 Hz an update longer than that drops a frame. The `frame` rule keeps
  the 95th percentile under it.
- **A long task, 50 ms.** The threshold of the browser's Long Tasks API: while one runs, a key
  press waits. The `long-task` rule allows none in replies up to 20k
  characters.
- **Linear in the reply.** Streaming a reply four times longer should cost about four times
  more (exponent 1). A renderer that reparses the whole text on every token costs about sixteen
  times more (exponent 2). The `linear` rule keeps flowdown under 1.25.
- **No leak.** Streaming the same reply again keeps less than 1 MB more: what is cached is
  bounded, and nothing grows with use. The `no-leak` rule.

## Running it

```sh
cd bench
bun install
bun run bench          # builds the package, measures flowdown, writes results/ (2 minutes)
bun run bench:all      # measures every renderer again (35 minutes): see below for when
bun run bench:check    # holds results/latest.json to budgets.json
bun run bench:quick    # one run, `frame` only, for a quick look; writes no `latest`
bun run browser        # the same streams in Chromium: results/browser.md (3 minutes)
bun run browser --all  # every renderer again in Chromium (45 minutes)
```

### The other renderers are measured once

`bun run bench` measures flowdown and keeps every other renderer's rows from
`results/reference.json`. Those renderers do not change between two runs, and they are 96% of a
full run: react-markdown alone is half of it. Do not measure them again to check a change to
flowdown.

The reference is the mean of every full run recorded in `results/` (`bun run reference`,
[src/reference.ts](src/reference.ts)): five to seven runs over four days as of 2026-11-12. One run
differs from the next by a tenth with how busy the machine is, so the mean is steadier than any
one of them, and it does not move when flowdown is measured again.

A row is kept only if it would come out the same measured today: the same version of that
renderer, the same reply (by its hash), the same machine, the same Bun and the same time budget.
If any of those differs the row is measured, so nothing has to be remembered. `latest.md` names
the renderers kept.

`bun run browser` does the same from its own last record, `results/browser.json`.

Run everything again (`bench:all`, then `bun run reference`; `browser --all`) only when a
renderer's version, a reply in `packages/flowdown/test/replies.ts`, the machine or the runtime
changes. Those rows are measured again by themselves anyway; the full run is to give the reference
more than one sample of them.

Options for `bun src/run.ts` (with `NODE_ENV=production`):

- `--all`: measure every renderer, keeping no row.
- `--only=chat-5k,answer-20k`: some scenarios.
- `--renderers=flowdown,streamdown`: some renderers.
- `--runs=5`: more runs per measurement.
- `--passes=3`: the whole table that many times over, each number the median of its passes;
  `bun run bench` passes it.
- `--label=name`: the name of the results file, `results/<date>-<name>.json`.
- `--no-write`: print only.

React runs its production build (`NODE_ENV=production`); the development build checks far more
on every render, and its numbers would be React's, not the renderer's. The DOM is happy-dom, so
absolute times are not a browser's: compare renderers and runs on the same machine, not with a
number measured elsewhere.

`bun run browser` is the check in a real browser. It bundles each renderer as a page would, streams
five scenarios token by token in Playwright's Chromium (`bunx playwright-core install
chromium-headless-shell`), six updates per animation frame, and reads script time and whole
main-thread time from the browser's own counters. Chromium's engine is V8 and Bun's is
JavaScriptCore: a cost only one of them has shows in only one of the two runs. It takes
`--only`, `--renderers`, `--runs` and `--no-write` as `run.ts` does, and no budget is held to it:
its times move with how warm the machine is.

## Results in git

Every full run writes `results/<date>-<label>.json`, with every number, the machine, the runtime,
the commit and the corpus hashes, and replaces `results/latest.json` and `results/latest.md`.
Commit them with the change they measure:

- A change that is about speed records a run before and after it, labelled
  (`--label=before-split`, `--label=after-split`).
- A release records one run labelled with its version.
- `latest.md` is what the docs quote.

Quick and partial runs never replace `latest`.

## Files

```tree
bench/
  README.md
  budgets.json      the targets
  package.json      the renderers compared, at pinned versions
  src/
    run.ts          runs the scenarios, writes results/
    measure.tsx     one run of one renderer
    renderers.tsx   how each renderer is set up
    report.ts       medians and the tables of latest.md
    reference.ts    the other renderers' mean over the recorded runs: results/reference.json
    check.ts        holds a run to budgets.json
    browser.ts      the same streams in Chromium: results/browser.md
    browser-page.tsx  the page it opens: one renderer, one stream
    parse.ts        the parser alone, against other parsers: results/parse.md
    parse-cell.ts   one parser through the corpus, in a process of its own
    parsers.ts      how each parser is set up
  results/
    latest.md
    latest.json
    reference.json
    browser.md
    browser.json
    parse.md
    parse.json
    <date>-<label>.json
```

## Checked with Claude Fable 5.2

On 2026-11-10 Claude Fable 5.2 reran every script here after flowdown moved to its own parser
and compared the output with what is committed: `bun run size`, `bun run features`, `bun run deps`,
`bun run charts` and the full `bun run bench` (three runs, Apple M5:
[results/2026-11-10-local.json](results/2026-11-10-local.json)). The feature table came out unchanged; the sizes, the
package count and the streaming times are the ones in [results/](results/). The parser was checked
against every example of CommonMark and of GitHub's extensions
([docs/conformance.md](../docs/conformance.md)), the new renderer against what the previous one
drew for about 2,300 documents, the block splitter against one parse of the whole document on
seeded documents ([blocks-fuzz.test.tsx](../packages/flowdown/src/core/blocks-fuzz.test.tsx)),
and the sanitizer with 159 attack inputs, whole and at every prefix of a stream
([security.test.tsx](../packages/flowdown/src/react/security.test.tsx)).

On 2026-11-11, for 0.4.1, it reran them again: `bun run size`, `bun run features`, `bun run deps`,
`bun run parse`, `bun run charts` and `bun run bench` with `--passes=3`, which is the run
[results/latest.md](results/latest.md) names now. Two full runs before it, on a machine that was
not quiet, each had a few streams half again slower than in the other, and never the same ones;
the three passes are the answer to that. The new parser was set against the one of 0.4.0 on about
250,000 documents (every reply here and each of its prefixes, the CommonMark spec with three kinds
of line ending, and 120,000 generated code blocks and tables) and wrote the same tree for each, and
0.4.0's build was streamed in turn with the new one to tell a slower stream from a noisy one.

The same day, for 0.4.2, the same scripts ran once more, `bun run bench` again with `--passes=3`.
The five other renderers came within 1% of their figures for 0.4.1 over the table, which is how
much the machine differed between the two runs; flowdown's own moved by what 0.4.2 changed.
0.4.1's build was streamed in turn with the new one, in one process, on each kind of reply; the
repair of an unfinished table row was set against 0.4.1's on about 438,000 texts and the parser
against 0.4.1's on about 198,000 documents, and each wrote what the old one did.

On 2026-11-12, after the changes that will be 0.5.1, `bun run size` and `bun run bench` with
`--passes=3` ran again, and `bun run browser` for the first time. The five other renderers came
within a few percent of their figures for 0.4.2. flowdown's own are higher by 3 to 15 ms a stream:
streamed in turn with the build before the changes, in one process, a 50k code block takes about
46 ms where it took 40. That is the code block asking, once a frame, whether it has come to scroll
sideways, so the keyboard can reach what is past its edge. The machine had run benchmarks for
hours by then, which is the rest. In Chromium the same build streams a 100k answer in a third to a
fifth of the script time the build before it took.

## The parser alone

`bun run parse` times each Markdown parser reading a whole text once, with no React and no DOM,
into [results/parse.md](results/parse.md) and [results/parse.json](results/parse.json)
([src/parse.ts](src/parse.ts)). The streaming benchmark above answers what a page pays; this one
isolates the step every renderer starts with, so a parser can be compared with parsers that
render nothing.

- **The parsers** ([src/parsers.ts](src/parsers.ts)): flowdown's engine, to its tree and on to
  HTML; mdast-util-from-markdown, remark's parser, which react-markdown and Streamdown run;
  micromark, the tokenizer under it; marked; markdown-it. Each reads GitHub's Markdown as far as
  its own packages go, with raw HTML passed through.
- **The texts**: the replies above, from the same seeds, and the CommonMark spec, the corpus
  markdown-it's and micromark's own benchmarks read.
- **Two engines**: the same bundle, built with the `production` export condition (micromark's
  development build carries assertions), runs under Bun (JavaScriptCore, Safari's engine) and Node
  (V8, Chrome's). One process per parser and run, so no parser runs on code another warmed.
- **Timing**: each parser is warmed up on each text, then timed one parse at a time, several in a
  row when one is shorter than 2 ms, for at least a second and 40 samples. Garbage collection
  stays in: it is part of what a parse costs. The median sample, then the median of three runs.
- **What was read**: headings, code blocks, tables, rows, list items, emphasis, strikethrough,
  footnote references and checkboxes are counted in every output and set against flowdown's
  tree, so a parser that skipped part of a text shows it instead of a speed it did not earn.

Options: `--quick` (one short run, writes nothing), `--runs=5`, `--runtimes=bun`,
`--parsers=flowdown,marked`, `--no-write`.

## Size and features

- `bun run size`: what a page downloads for each renderer, in a production build, into
  [results/size.md](results/size.md) ([src/size.ts](src/size.ts)).
- `bun run features`: the same inputs through each renderer, checked on the DOM it drew, into
  [results/features.md](results/features.md) and [results/features.json](results/features.json),
  which keeps the markup behind every mark ([src/features.tsx](src/features.tsx)).
- `bun run deps`: how many packages each renderer installs, its licence and its styles, from the
  lockfile, into [results/install.json](results/install.json) ([src/install.ts](src/install.ts)).
- `bun run charts`: the README's comparison chart, drawn from results/latest.json,
  results/size.json and results/install.json into
  [results/charts/compare.png](results/charts/compare.png) ([src/charts.ts](src/charts.ts)). One
  light image for every theme, rasterized by Playwright's Chromium
  (`bunx playwright-core install chromium-headless-shell`).

