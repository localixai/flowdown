# Benchmark

How much main-thread work it costs to stream a model's reply into the page, measured the same
way for llx-markdown and for the renderers it is compared with. This is the number the library
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

## Scenarios

The replies are generated from fixed seeds by
[`packages/llx-markdown/test/replies.ts`](../packages/llx-markdown/test/replies.ts): the same text
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

Chunk patterns ([`test/chunks.ts`](../packages/llx-markdown/test/chunks.ts)):

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
  react-markdown with block memoization and its own healing (`remend`). The bar llx-markdown has
  to clear: `reference` allows at most 25% more total time.
- **react-markdown** with remark-gfm: what most pages use, and what llx-markdown and Streamdown
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
  times more (exponent 2). The `linear` rule keeps llx-markdown under 1.25.
- **No leak.** Streaming the same reply again keeps less than 1 MB more: what is cached is
  bounded, and nothing grows with use. The `no-leak` rule.

## Running it

```sh
cd bench
bun install
bun run bench          # builds the package, runs everything, writes results/
bun run bench:check    # holds results/latest.json to budgets.json
bun run bench:quick    # one run, `frame` only, for a quick look; writes no `latest`
```

Options for `bun src/run.ts` (with `NODE_ENV=production`):

- `--only=chat-5k,answer-20k`: some scenarios.
- `--renderers=llx,streamdown`: some renderers.
- `--runs=5`: more runs per measurement.
- `--label=name`: the name of the results file, `results/<date>-<name>.json`.
- `--no-write`: print only.

React runs its production build (`NODE_ENV=production`); the development build checks far more
on every render, and its numbers would be React's, not the renderer's. The DOM is happy-dom, so
absolute times are not a browser's: compare renderers and runs on the same machine, not with a
number measured elsewhere.

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
    check.ts        holds a run to budgets.json
  results/
    latest.md
    latest.json
    <date>-<label>.json
```

## Checked with Claude Fable 5.2

On 2026-11-10 Claude Fable 5.2 reran every script here after llx-markdown moved to its own parser
and compared the output with what is committed: `bun run size`, `bun run features`, `bun run deps`,
`bun run charts` and the full `bun run bench` (three runs, Apple M5, the run
[results/latest.md](results/latest.md) names). The feature table came out unchanged; the sizes, the
package count and the streaming times are the ones in [results/](results/). The parser was checked
against every example of CommonMark and of GitHub's extensions
([docs/conformance.md](../docs/conformance.md)), the new renderer against what the previous one
drew for about 2,300 documents, the block splitter against one parse of the whole document on
seeded documents ([blocks-fuzz.test.tsx](../packages/llx-markdown/src/core/blocks-fuzz.test.tsx)),
and the sanitizer with 159 attack inputs, whole and at every prefix of a stream
([security.test.tsx](../packages/llx-markdown/src/react/security.test.tsx)).

## Size and features

- `bun run size`: what a page downloads for each renderer, in a production build, into
  [results/size.md](results/size.md) ([src/size.ts](src/size.ts)).
- `bun run features`: the same inputs through each renderer, checked on the DOM it drew, into
  [results/features.md](results/features.md) and [results/features.json](results/features.json),
  which keeps the markup behind every mark ([src/features.tsx](src/features.tsx)).
- `bun run deps`: how many packages each renderer installs, its licence and its styles, from the
  lockfile, into [results/install.json](results/install.json) ([src/install.ts](src/install.ts)).
- `bun run charts`: the README's comparison chart, drawn from results/size.json and
  results/latest.json into [results/charts](results/charts) ([src/charts.ts](src/charts.ts)).

