---
title: Components
description:
  Replace any element the renderer draws with your own, wrap the built-in ones, and translate the
  words it adds.
---

# Components

`components` maps an element to the React component that draws it, as in react-markdown:

```tsx
import { Markdown, type Components } from 'llx-markdown'
import { Link } from './router'

const components: Components = {
  a: ({ node, href = '', ...props }) =>
    href.startsWith('/') ? (
      <Link to={href} {...props} />
    ) : (
      <a href={href} target="_blank" rel="noreferrer" {...props} />
    ),
}

;<Markdown components={components}>{text}</Markdown>
```

Each component receives the element's attributes as props, its `children`, and `node`, the hast
element it was made from. Leave `node` out of what you spread onto the DOM.

> [!IMPORTANT] Keep `components` stable
> Define the map at module level, or in `useMemo`. Blocks are remembered between updates, and a new
> `components` object on every render redraws every block on every token, which undoes most of
> [streaming](streaming.md)'s work.

## What is drawn by default

| Element         | Drawn by    | What it adds                                                                     |
| --------------- | ----------- | -------------------------------------------------------------------------------- |
| `blockquote`    | `Callout`   | A `> [!NOTE]`-style quote becomes `aside.llx-callout` with `role="note"`. Other quotes stay quotes. |
| `table`         | `Table`     | A `div.llx-table` around it that scrolls sideways.                                |
| `answer-tabs`   | `Tabs`      | The `[!TABS]` form: a tab list with the WAI-ARIA tabs keys.                       |
| `answer-tab`    | `Tab`       | One tab's panel; its label is in `data-label`.                                    |
| `pre`           | `CodeBlock` | `figure.llx-code` with the language and a copy button.                            |
| `code`          | `Code`      | Highlighting, when a [highlighter](highlighting.md) is set.                       |
| ` ```mermaid `  | `Diagram`   | The [diagram](diagrams.md).                                                       |
| ` ```tree `     | `FileTree`  | A directory tree with folders that open and close.                                |

Every other element (`p`, `a`, `img`, `ol`, `h2`, …) is the plain HTML element.

Your `components` replace these, with one exception: ` ```mermaid ` and ` ```tree ` fences never
reach your `code` or `pre`. A `pre` you pass draws every other fenced block, and a `code` you pass
draws every other piece of code. To draw the two fences yourself, pass `diagram` and `tree`:

```tsx
import { Markdown, type MarkdownComponents } from 'llx-markdown'

const components: MarkdownComponents = {
  // `growing`: this is the fence still being written. Every diagram above it is complete.
  diagram: ({ source, growing }) => (growing ? <Placeholder /> : <MyDiagram source={source} />),
  tree: ({ source }) => <MyTree source={source} />,
}

<Markdown streaming={!done} components={components}>{reply}</Markdown>
```

## Wrap a built-in component

The built-in components are exported, so you can add to them instead of starting over. A code block
with a "Run" button, keeping the language bar, the copy button and highlighting:

```tsx
import { CodeBlock, childrenToText, getLanguage, type Components } from 'llx-markdown'

const components: Components = {
  pre: (props) => {
    const code = props.children as React.ReactElement<{ className?: string; children?: unknown }>
    const language = getLanguage(code.props.className)
    return (
      <div className="runnable">
        <CodeBlock {...props} />
        {language === 'sql' && (
          <button onClick={() => runQuery(childrenToText(code.props.children as never))}>Run</button>
        )}
      </div>
    )
  },
}
```

`Code` inside your `pre` still highlights: the inner `code` is drawn by `Code` unless you replace
it too.

## Style the dialect's elements

The forms are plain HTML elements with `llx-` classes and data attributes, so most changes are CSS;
see [Styling](styling.md). To change their markup, override the HTML element and check the class:

| Form          | Element                                                  |
| ------------- | -------------------------------------------------------- |
| Callout       | `blockquote` with `data-callout` and `data-callout-title` |
| Steps         | `ol.llx-steps`, each item a `div.llx-step-head` (title, meta) and `div.llx-step-body` |
| Stats         | `ul.llx-stats`, each item a `div.llx-stat`               |
| Pros and cons | `div.llx-verdicts`, each side an `aside.llx-verdict` with `data-verdict="pros"` or `"cons"` |
| Tabs          | `answer-tabs` with `answer-tab` children                 |
| Quote source  | `footer.llx-quote-source`                                |
| Figure        | `figure.llx-figure` with a `figcaption`                  |
| Section number | `span.llx-section-number` at the start of a heading      |

A form with a title (`> [!STEPS] Plan`) is wrapped in `div.llx-form`, the title a `p.llx-steps-title`
(`llx-tabs-title`, `llx-stats-title`, …) before the form.

```tsx
const components: Components = {
  ol: ({ node, className, ...props }) =>
    className === 'llx-steps' ? (
      <ol className={`${className} my-timeline`} {...props} />
    ) : (
      <ol className={className} {...props} />
    ),
}
```

A callout's component receives the kind in `data-callout` (`note`, `tip`, `important`, `warning`,
`caution`) and the author's title, if any, in `data-callout-title`:

```tsx
import { Callout, type Components } from 'llx-markdown'

const components: Components = {
  blockquote: (props) =>
    props['data-callout'] === 'caution' ? <DangerBanner>{props.children}</DangerBanner> : <Callout {...props} />,
}
```

## Use the components on their own

`FileTree` draws a tree from the body of a ` ```tree ` fence anywhere in your page:

```tsx
import { FileTree } from 'llx-markdown'

;<FileTree source={'src/\n├── index.ts\n└── app/\n    └── App.tsx'} />
```

Pass `getIcon(row, open)` to choose the icon of each row; `row` is a `TreeRow` with its `name`,
`depth`, `path`, `folder` and `comment`.

`Diagram` takes `source` and draws it with the Mermaid loader of the `<Markdown>` it is inside;
outside one, it shows the source.

## Helpers

| Helper                            | Returns                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `getLanguage(className)`          | The language of a `language-*` class: `'ts'` for `language-ts`. |
| `childrenToText(children)`        | The text of React children, for copying or measuring.           |
| `isCodeBlock(children, className)` | Whether a `code` element is a block (it has a language or a newline) rather than inline code. |

## Labels

The renderer adds a few words of its own: names of callouts for screen readers, button labels,
diagram notes. Translate them with `labels`; every key is optional:

```tsx
<Markdown
  labels={{
    copy: 'Code kopieren',
    copied: 'Kopiert',
    callouts: { warning: 'Warnung' },
    diagramFailed: (reason) => `Diagramm nicht darstellbar: ${reason}`,
  }}
>
  {text}
</Markdown>
```

| Key                  | Default                                  | Where                                                   |
| -------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `callouts.note`      | `Note`                                   | A callout's name, read by screen readers. Not printed.  |
| `callouts.tip`       | `Tip`                                    |                                                         |
| `callouts.important` | `Important`                              |                                                         |
| `callouts.warning`   | `Warning`                                |                                                         |
| `callouts.caution`   | `Caution`                                |                                                         |
| `variants`           | `Variants`                               | The tab list's name.                                    |
| `fileTree`           | `File tree`                              | The tree's name.                                        |
| `diagram`            | `Diagram`                                | A drawn diagram's name.                                 |
| `drawingDiagram`     | `Drawing diagram…`                       | Shown while Mermaid loads and lays out.                 |
| `diagramFailed`      | ``(reason) => `Diagram could not be drawn: ${reason}` `` | Shown when the source does not parse.  |
| `copy`               | `Copy code`                              | The copy button.                                        |
| `copied`             | `Copied`                                 | The copy button after a copy.                           |

A callout with a title (`> [!TIP] Faster builds`) is named by its title instead. `DEFAULT_LABELS`
holds the English set.
