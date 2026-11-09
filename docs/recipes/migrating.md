---
title: Migrating
description:
  Move from react-markdown or Streamdown to llx-markdown — what maps one to one, what moves to CSS,
  and what has no equivalent.
---

# Migrating

## From react-markdown

llx-markdown is built on react-markdown, so most of a page carries over.

```tsx
// Before
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

;<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]} components={components}>
  {text}
</ReactMarkdown>

// After
import { Markdown } from 'llx-markdown'
import 'llx-markdown/styles.css'

;<Markdown components={components}>{text}</Markdown>
```

| react-markdown                          | llx-markdown                                                         |
| --------------------------------------- | -------------------------------------------------------------------- |
| `children`                              | `children`                                                           |
| `components`                            | `components`, the same map. Keep it stable.                          |
| `remarkPlugins={[remarkGfm]}`           | Built in.                                                            |
| `rehypeRaw` + `rehypeSanitize`          | Built in, on by default (`html`).                                    |
| `skipHtml`                              | `html={false}`                                                       |
| `urlTransform`                          | `urlTransform`, the same function.                                   |
| `remark-math` + `rehype-katex`          | `math={() => import('llx-markdown/math')}`                           |
| `rehype-highlight`                      | `highlight={highlight}` from `llx-markdown/highlight`                |
| `className` on a wrapper                | `className`                                                          |
| `remarkPlugins`, `rehypePlugins` of your own | Not accepted. Keep react-markdown and add `remarkLlx` from `llx-markdown/remark`; see [Remark and rehype](../remark.md#react-markdown-with-your-own-components). |
| `allowElement`, `disallowedElements`, `unwrapDisallowed` | Not accepted. Override the element in `components` to drop or unwrap it. |

What changes for the reader:

- A streaming reply is parsed block by block, so a long reply costs about the same per token as a
  short one. Pass `streaming` while it arrives.
- Quotes with `[!NOTE]`-style markers become callouts, and the forms (`[!STEPS]`, `[!TABS]`, …)
  render. Text that never used them looks as before.
- Fenced code has a language bar and a copy button, and tables scroll sideways in their own box.
- With raw HTML on, ids and names in a reply are prefixed `user-content-`, as on GitHub.

## From Streamdown

Streamdown and llx-markdown solve the same problem, a reply that renders while it streams, in a
similar way: both cut the reply into blocks, memoize them and complete the unfinished end. The
differences are the dialect, the styling and how features are added.

```tsx
// Before
import { Streamdown } from 'streamdown'

;<Streamdown isAnimating={isStreaming} caret="block">
  {text}
</Streamdown>

// After
import { Markdown } from 'llx-markdown'
import 'llx-markdown/styles.css'

;<Markdown streaming={isStreaming}>{text}</Markdown>
```

| Streamdown                                   | llx-markdown                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `children`                                   | `children`                                                                    |
| `isAnimating`                                | `streaming`                                                                   |
| `mode="static"`                              | `streaming={false}`, the default.                                             |
| `parseIncompleteMarkdown`                    | Always on while `streaming`, off for the finished text.                       |
| `caret="block"` / `"circle"`                 | `caret`, on by default while streaming. Its look is CSS: see [Styling](../styling.md). |
| `components`                                 | `components`                                                                  |
| `className`                                  | `className`                                                                   |
| `plugins.code` (Shiki), `shikiTheme`         | `highlight`, and the `--llx-code-*` tokens for colours. See [Highlighting](../highlighting.md). |
| `plugins.math`                               | `math`. See [Math](../math.md).                                               |
| `plugins.mermaid`, `mermaid.config`          | `mermaid={() => import('mermaid')}`, coloured from the page's tokens. See [Diagrams](../diagrams.md). |
| `controls`                                   | A copy button on each code block. Other buttons: override `pre` and wrap `CodeBlock`; see [Components](../components.md#wrap-a-built-in-component). |
| `codeBlockMaxHeight`, `tableMaxHeight`       | CSS on `.llx-code pre` and `.llx-table`.                                      |
| `linkSafety`                                 | Override `a` in `components`, and `urlTransform`.                             |
| `allowedTags`                                | No equivalent: the sanitizer's schema is fixed. Use your own pipeline with `sanitizeSchema` from `llx-markdown/remark`. |
| `remarkPlugins`, `rehypePlugins`             | Not accepted; see the react-markdown section above.                           |
| `dir`                                        | Set `dir` on an element around `<Markdown>`.                                  |
| `animated`                                   | No equivalent. Animate in CSS if you want text to fade in.                    |
| `BlockComponent`, `parseMarkdownIntoBlocksFn` | No equivalent. `createBlockSplitter` from `llx-markdown/remark` is the splitter `<Markdown>` uses. |
| `remend` options                             | No options. The healing rules are in `closePartialMarkdown`; see [Streaming](../streaming.md). |

### Styling

Streamdown draws with Tailwind classes. llx-markdown ships its own stylesheet driven by `--llx-*`
tokens, with no Tailwind needed. Remove the `@source` line Streamdown's setup added to your
Tailwind CSS, import `llx-markdown/styles.css`, and set the tokens to your theme's colours; see
[Styling](../styling.md).

### Links and images

Streamdown's default hardening accepts links and images with any prefix and protocol. llx-markdown
keeps react-markdown's check: relative URLs and `http`, `https`, `mailto`, `irc`, `ircs`, `xmpp`.
A reply that linked to `tel:` or another app's scheme now gets an empty link; allow it with
`urlTransform`, as shown in [Security](../security.md#links-and-images).

### Prompt

Streamdown renders what the model writes. llx-markdown also gives the model the dialect to write:
add `answerFormatPrompt()` to the system prompt to get steps, tabs and callouts. See
[Prompting](../prompting.md).
