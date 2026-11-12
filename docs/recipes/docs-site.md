---
title: A documentation site
description:
  Render Markdown pages with flowdown in a prerendered site — headings with ids, a table of
  contents, links between pages, and pages that hydrate without a mismatch.
---

# A documentation site

A site of Markdown pages, rendered with React and prerendered to HTML, the pages kept as Markdown
files beside the code. This recipe shows the parts that are about flowdown.

## One wrapper for every page

Set the renderer up once, with the stages the site uses, and render every page through it:

```tsx
// markdown.tsx
import { Markdown, type MarkdownProps } from '@localix-ai/flowdown'
import { highlight } from '@localix-ai/flowdown/highlight'
import { html } from '@localix-ai/flowdown/html'
import '@localix-ai/flowdown/styles.css'
import 'katex/dist/katex.min.css'

const loadMath = () => import('@localix-ai/flowdown/math')
const loadMermaid = () => import('mermaid')

export function DocMarkdown(props: Omit<MarkdownProps, 'html' | 'math' | 'mermaid' | 'highlight'>) {
  return <Markdown {...props} html={html} math={loadMath} mermaid={loadMermaid} highlight={highlight} />
}
```

- **`html={html}`, the stage itself.** Docs hold a few tags (`<kbd>`, `<details>`). With the default
  loader, the prerendered page would leave them out and the client would add them after loading the
  parser: the markup would not match and React would warn while hydrating. Passing the stage
  parses them in the first render, on the server and the client alike.
- **Math and Mermaid as loaders.** A page without a formula never fetches KaTeX, and a page without
  a diagram never fetches Mermaid. The prerendered page shows a diagram's source, and the client
  draws it after hydration, which React does not count as a mismatch.
- **Loaders at module level.** Every page shares one loaded KaTeX and one Mermaid.

## Headings and a table of contents

`headingIds` gives each heading an id, and `extractHeadings` returns the same ids for an outline:

```tsx
import { useMemo } from 'react'
import { extractHeadings } from '@localix-ai/flowdown'

export function DocPage({ body }: { body: string }) {
  const headings = useMemo(() => extractHeadings(body), [body])
  return (
    <>
      <article>
        <DocMarkdown headingIds>{body}</DocMarkdown>
      </article>
      <nav aria-label="On this page">
        {headings
          .filter((heading) => heading.depth === 2 || heading.depth === 3)
          .map((heading) => (
            <a key={heading.id} href={`#${heading.id}`} data-depth={heading.depth}>
              {heading.text}
            </a>
          ))}
      </nav>
    </>
  )
}
```

A repeated heading is numbered (`setup`, `setup-1`) in both, so the outline links to the right one.
`extractHeadings` also feeds a search index: each heading is a place a result can link to.

## Links between pages

Docs link to each other by file (`[Math](math.md)`), which also works on GitHub. Override `a` to turn
those into the site's routes, and to open other sites in a new tab:

```tsx
import type { Components } from '@localix-ai/flowdown'

function linkFor(pagePath: string): Components['a'] {
  return ({ node, href, ...props }) => {
    const target = href ? resolveDocHref(href, pagePath) : href // math.md#x → /math/#x
    const external = !!target && /^https?:/.test(target)
    return external ? (
      <a href={target} target="_blank" rel="noreferrer" {...props} />
    ) : (
      <Link to={target ?? ''} {...props} />
    )
  }
}

// In the page: one components object per page, not per render.
const components = useMemo<Components>(() => ({ a: linkFor(page.path) }), [page.path])
```

The components object is created once per page: a new one on every render would redraw every block.

## Front matter

flowdown renders Markdown, not front matter. Read the `title` and `description` from the file
and pass only the body:

```ts
const [, frontMatter, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw) ?? [, '', raw]
```

Turn the front matter into the page's `<title>` and `<meta name="description">`.

## For people and for models

The source of each page is already the best version for a model. Publish it beside the HTML:

- each page's Markdown at its own URL, and a "Copy page as Markdown" button;
- `llms.txt`, the [llms.txt](https://llmstxt.org) index of every page with its description;
- `llms-full.txt`, every page in one file.

## Check it

- Build and open a page with JavaScript off: the text, tables, callouts and code are all there.
- Open the console while the page hydrates: no hydration warnings.
- Switch the theme: diagrams are drawn again in the new colours.
