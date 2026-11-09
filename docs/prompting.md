---
title: Prompting
description:
  Teach a model the dialect with one function — what the prompt says, what it costs, where to put
  it, and how to keep it in step with the renderer.
---

# Prompting

A model writes the forms it was told about and no others. `llx-markdown/prompt` holds the
instructions that teach it the dialect, ready to place in a system prompt:

```ts
import { answerFormatPrompt } from 'llx-markdown/prompt'

const system = ['You are a helpful assistant.', answerFormatPrompt()].join('\n\n')
```

The entry is plain text with no React and no DOM, so it runs on a server, in an edge function or in
a build script.

## What it costs

| Call                                            | Characters | Tokens, about |
| ----------------------------------------------- | ---------- | ------------- |
| `answerFormatPrompt()`                          | 1,621      | 400           |
| `answerFormatPrompt({ math: true, diagrams: true })` | 2,092 | 520           |

Tokens are estimated at four characters each; the exact count depends on the model's tokenizer.

The text is the same on every call with the same options. Place it in the stable part of the system
prompt, before anything that changes per request, and it stays inside a cached prompt prefix.

## What it says

The default prompt, in full:

```markdown
# Answer formatting
- Shape every reply with the forms in "Answer formatting": the page renders them, and a plain list or table where a form fits is a formatting defect.
Replies render as GitHub Markdown plus the forms below; the user's style preferences override them.
Match the content to the first form that fits; a table or list is the fallback. Write a marker as its own quote line, the content unquoted after it.
- Lead with the answer. Short replies use prose; long ones use `##` per thread, short paragraphs and selective bold.
- Options compared (X vs Y, which to use) or variants (per OS, language): a tab per option, `#### Label`; a compared option holds its sides. Then one line on when to pick which:
  > [!TABS]
  #### PostgreSQL
  > [!PROS]
  - concurrent writes

  > [!CONS]
  - needs a server
- One option weighed (should I, is it worth it): its sides, then the verdict:
  > [!PROS]
  - typed APIs

  > [!CONS]
  - a build step
- Stages in order (a plan, recovery, schedule, by day, a procedure): steps, never a numbered list:
  > [!STEPS]
  1. **First 24 hours**
     *Day 1*
     Rest and keep warm.
- Headline figures (speedups, sizes, key numbers): stats:
  > [!STATS]
  - **3×** faster installs
  - **−40%** memory
- Exact values across options (specs, prices, limits): a table.
- A risk or key aside: one or two callouts, quotes starting `> [!KIND]` ([!NOTE] [!TIP] [!IMPORTANT] [!WARNING] [!CAUTION]); text after the marker titles it.
- A directory layout: a ```tree fence of `├──`/`└──` lines. Things to do: `- [ ] item`.
- Quote attribution: `> — Author`. Image caption: `![alt](url "Caption")`.
```

Why it is written this way:

- **A decision list, not a catalogue.** Each line names the content first ("options compared",
  "stages in order") and the form second, and the first match wins. A list of the forms with what
  each looks like made "compare X and Y" match only the table, and every comparison came back as a
  table.
- **An example under each rule.** A model that was only told about a form kept writing the numbered
  list it writes by habit. A short example, two spaces in, is copied.
- **The user's style wins.** A user who asks for plain text, or for no tables, gets it.

Each example is rendered by the package's tests and must come out as its form, with no marker left
as text. A change to the dialect that would leave the prompt teaching a broken form fails there.

## Options

```ts
answerFormatPrompt({
  header: '## Formatting', // the section's heading line; '# Answer formatting' by default
  math: true, // mention $…$ math
  diagrams: true, // teach ```mermaid diagrams and the kinds that draw well
})
```

> [!IMPORTANT] Turn features on in both places
> `math` and `diagrams` are off in the prompt for the same reason they are off in `<Markdown>`. A
> model told about diagrams the page does not draw shows the reader Mermaid source; a page that
> draws diagrams the model was not told about never receives one. Pass the same choice to both:
>
> ```ts
> const features = { math: true, diagrams: true }
> const system = answerFormatPrompt(features)
> // and on the page:
> // <Markdown math={features.math ? loadMath : null} mermaid={features.diagrams ? loadMermaid : null}>
> ```

## In a system prompt with its own rules

Many system prompts open with a short list of rules and put longer sections below. A form described
only in a section further down reads as an optional reference: a model still answered "plan it by day"
with a numbered list. `answerFormsPrinciple()` is the first line of the section on its own, to place
among your leading rules as well:

```ts
import { answerFormatPrompt, answerFormsPrinciple } from 'llx-markdown/prompt'

const system = [
  'You are a helpful assistant.',
  ['Rules:', '- Be concise.', answerFormsPrinciple()].join('\n'),
  // … your other sections
  answerFormatPrompt(),
].join('\n\n')
```

Pass the same `header` to both if you change it: the principle names the section by its heading.

## Building your own prompt

`ANSWER_FORM_EXAMPLES` holds the examples the prompt shows (`comparison`, `verdict`, `steps`,
`stats`), each as an array of lines, and `ANSWER_FORMAT_HEADER` the default heading. Use them to
write instructions in your own words while showing the model forms the renderer is known to draw.

The full syntax a model can use is on [Syntax](syntax.md).
