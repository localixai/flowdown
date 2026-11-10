---
title: Security
description:
  What llx-markdown does with untrusted text by default — raw HTML, links, images, code, formulas
  and diagrams — and where to tighten it.
---

# Security

A model's reply is untrusted text: it repeats what it read on a web page, in a file or in another
user's message. llx-markdown renders it without running anything it contains. This page lists
exactly what the defaults let through, so you can decide what to tighten.

## Raw HTML

| `html`                         | What happens to `<b>`, `<details>`, `<img onerror=…>`                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `true` (the default)           | The HTML reader is fetched the first time a document holds HTML. Until it arrives, the tags are left out. Then they are parsed and sanitized. |
| `html` from `llx-markdown/html` | Parsed and sanitized in the first render (for a server or a hydrating page).                                               |
| `false`                        | Every tag is dropped. The text between the tags stays.                                                                     |

HTML is never shown unsanitized: while the reader loads, tags are skipped, not printed or
inserted.

The sanitizer is the package's own. It keeps an allow-list: GitHub's schema, the rules github.com
applies to a README, extended for what llx-markdown itself draws. An element, attribute or URL
protocol that is not on the list does not reach the page:

- **Removed:** `<script>`, `<style>`, `<iframe>`, `<form>` and every other element the schema does
  not list; every `on…` attribute; `style`; any URL in `href` or `src` whose protocol is not allowed.
- **Allowed on top of GitHub's list:** `div`, `span`, `picture`, `source`, `aside`, `figure`,
  `figcaption`, `footer`, and the dialect's `answer-tabs` and `answer-tab`.
- **Attributes allowed on top of GitHub's list:** `align`, `width` and `height` everywhere; a class
  only when it starts with `llx-`; `data-callout`, `data-callout-title`, `data-verdict`,
  `data-label` and `data-title`; `target` and `rel` on links; `srcset`, `media` and `type` on `<source>`; the task
  list classes on lists.
- **Prefixed:** an `id` or `name` in the reply becomes `user-content-…`, so a reply cannot replace
  an element of your page that `document.getElementById` or a form looks up.

HTML never becomes a string that the browser parses: each allowed tag is made a React element
with its allowed attributes, so there is no markup for a reply to break out of. Formulas are
typeset after the sanitizer, so KaTeX's own markup is not stripped and nothing in a reply can
disguise itself as KaTeX's.

Turn HTML off where replies have no reason to contain it:

```tsx
<Markdown html={false}>{text}</Markdown>
```

## Links and images

Every link and image URL goes through `urlTransform`. The default, `defaultUrlTransform`, is the check
react-markdown made familiar: relative URLs, fragments and the protocols `http`, `https`, `mailto`, `irc`, `ircs` and `xmpp` are kept; any
other URL (`javascript:`, `data:`, `vbscript:`, but also `tel:`) is refused. A refused URL is
dropped, not left empty: the link keeps its text and has no `href`, the image has no `src`, and an
element an extension or raw HTML wrote loses that attribute. An empty `href` would link to the page
itself, and an empty `src` makes the browser fetch the page again.

Pass your own to allow more, or less:

```tsx
// Relative URLs, and absolute ones whose protocol is listed here.
const allowed = /^(https?|mailto|tel):/i
const hasProtocol = /^[a-z][a-z\d+.-]*:/i

const urlTransform = (url: string) => (!hasProtocol.test(url) || allowed.test(url) ? url : '')

;<Markdown urlTransform={urlTransform}>{text}</Markdown>
```

Your function refuses a URL by returning `''`, `null` or `undefined`. `urlTransform={null}` does not
turn the check off: the default is used. To accept
every URL, pass `(url) => url`, and do not do that for untrusted text.

Two things the defaults do not do:

- **Links open in the same tab**, with no `rel`. A page that opens them elsewhere overrides `a`; see
  [Components](components.md).
- **Images load from any `http` or `https` address.** A reply can show a remote image, and loading
  it tells that server the reader's address. Override `img` to proxy images or allow only your
  own hosts, or set a Content Security Policy (`img-src`).

## Code

Code is text. Fenced and inline code are printed as escaped text, and a highlighter's output is the
one place HTML from code reaches the page: the bundled `llx-markdown/highlight` escapes the code
first. A [highlighter of your own](highlighting.md#your-own-highlighter) must do the same.

The copy button writes to the clipboard only when the reader presses it.

## Formulas

Formulas are typeset with KaTeX's defaults: `trust` is off, so `\href`, `\url`, `\includegraphics`
and `\htmlClass` do not produce links, images or classes. A formula that does not parse is shown as
source in KaTeX's error style.

## Diagrams

Mermaid runs with `securityLevel: 'strict'`: HTML in labels is encoded as text, and `click`
handlers are off. A diagram cannot run script or link anywhere. Mermaid is only loaded when you pass
a loader.

## What it does not replace

llx-markdown keeps a reply from running code in your page. It does not decide what a reply may say
or link to. For a page that shows replies to other people:

- send a **Content Security Policy** that forbids inline script and limits `img-src`;
- keep **auth tokens out of URLs** a reply could link to or repeat;
- treat a link in a reply as a link from a stranger: the URL check stops `javascript:`, not
  phishing.
