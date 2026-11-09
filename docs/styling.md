---
title: Styling
description: Recolour llx-markdown with CSS tokens, follow your page's light and dark mode, and restyle any element of the dialect.
---

# Styling

```ts
import 'llx-markdown/styles.css'
```

One stylesheet, about 4 KB compressed, with no framework behind it. Every rule is scoped to the
`.llx-markdown` element the renderer draws, so it touches nothing else on the page.

## Light and dark

The colours are written with CSS `light-dark()`, so the renderer follows the colour scheme of the
page around it:

| Your page has | The Markdown is |
| --- | --- |
| `color-scheme: dark` on an ancestor | dark |
| a `.dark` class or `data-theme="dark"` on an ancestor | dark |
| `:root { color-scheme: light dark }` | the reader's system setting |
| nothing | light |

A page with no dark mode stays light even on a dark system, as the rest of the page does. To pin
one block, give it a class and set `color-scheme` on it, or wrap it in an element with
`data-theme`:

```tsx
<Markdown className="preview">{text}</Markdown>

<div data-theme="dark">
  <Markdown>{text}</Markdown>
</div>
```

```css
.preview { color-scheme: dark; }
```

## Tokens

Every colour, font and radius is a custom property. Set them on `.llx-markdown`, or on any
ancestor, to match your design system:

```css
.llx-markdown {
  --llx-fg: var(--foreground);
  --llx-bg: var(--background);
  --llx-border: var(--border);
  --llx-link: var(--primary);
  --llx-radius: var(--radius);
}
```

The defaults sit at zero specificity, so any rule that sets a token wins. A token you set once
holds in both themes; to give each theme its own value, use `light-dark()` as well.

> [!TABS]
#### Text and surfaces
| Token | Used for |
| --- | --- |
| `--llx-fg` | Body text; panels are mixed from it. |
| `--llx-fg-soft` | Secondary text: a step's body, a quote. |
| `--llx-fg-faint` | Annotations: a step's "when", a tree comment, a code language. |
| `--llx-bg` | The ground the Markdown sits on; diagrams mix their fills over it. |
| `--llx-border`, `--llx-border-subtle`, `--llx-border-strong` | Table rules, tab underlines, tree guides. |
| `--llx-veil`, `--llx-veil-strong` | Panels: callouts, stats, code blocks. Mixed from `--llx-fg`. |
| `--llx-link` | Links. |
| `--llx-focus` | Focus rings on tabs, tree rows, the copy button. |

#### Status
| Token | Used for |
| --- | --- |
| `--llx-info` | `NOTE` callouts. |
| `--llx-success` | `TIP` callouts, the pros' marks. |
| `--llx-important` | `IMPORTANT` callouts. |
| `--llx-warning` | `WARNING` callouts. |
| `--llx-danger` | `CAUTION` callouts, the cons' marks. |

These colour glyphs and marks only, never a fill.

#### Code
| Token | Used for |
| --- | --- |
| `--llx-code-bg`, `--llx-code-fg` | Code blocks. |
| `--llx-code-comment` | Comments. |
| `--llx-code-keyword` | Keywords. |
| `--llx-code-string` | Strings. |
| `--llx-code-number` | Numbers and literals. |
| `--llx-code-function` | Function and class names. |
| `--llx-code-type` | Types and built-ins. |
| `--llx-code-tag` | Markup tags. |

#### Diagrams
| Token | Used for |
| --- | --- |
| `--llx-chart-1` … `--llx-chart-8` | Diagram series, in order: pie slices, chart lines, git branches. |

Diagrams read these tokens when they are drawn, so a diagram matches the page it sits on.

#### Shape and type
| Token | Used for |
| --- | --- |
| `--llx-font-heading` | Headings. Inherits the page's font by default. |
| `--llx-font-mono` | Code, trees. |
| `--llx-radius`, `--llx-radius-small` | Panels; buttons and inline code. |
| `--llx-duration` | Hover and focus transitions. |
| `--llx-caret-color` | The streaming caret. The text colour by default. |

---

Body text uses the font of the page around it.

## Restyling an element

Every element the dialect adds has a class. Restyle one with a selector that starts at
`.llx-markdown`, as the package's own rules do:

```css
.llx-markdown .llx-step-title { font-size: 1.05rem; }
.llx-markdown .llx-tab[aria-selected='true'] { color: var(--brand); }
```

| Form | Classes |
| --- | --- |
| Every form | `.llx-form`; a titled form has `.llx-steps-title`, `.llx-tabs-title` or `.llx-stats-title` above it |
| Callout | `.llx-callout[data-callout="warning"]`, `.llx-callout-icon`, `.llx-callout-title`, `.llx-callout-body` |
| Steps | `.llx-steps`, `.llx-step-head`, `.llx-step-title`, `.llx-step-meta`, `.llx-step-body` |
| Tabs | `.llx-tabs`, `.llx-tab-list`, `.llx-tab`, `.llx-tab-panel` |
| Stats | `.llx-stats`, `.llx-stat`, `.llx-stat-value`, `.llx-stat-label` |
| Pros and cons | `.llx-verdicts`, `.llx-verdict[data-verdict="pros"]`, `.llx-verdict-title`, `.llx-verdict-list` |
| File tree | `.llx-tree`, `.llx-tree-row`, `.llx-tree-name`, `.llx-tree-comment` |
| Diagram | `.llx-diagram`, `.llx-diagram-canvas` |
| Code block | `.llx-code`, `.llx-code-bar`, `.llx-code-language`, `.llx-code-copy` |

The root carries `data-streaming` while a reply streams, and `data-caret` while its caret shows.

The stylesheet is not in a cascade layer on purpose: a page's own reset for `button` or `ul`, in
no layer, would then win over the tabs and the lists. To replace an element outright rather than
restyle it, see [Components](components.md).

## Without the stylesheet

You can leave `styles.css` out and style the classes yourself; the markup is the same. The tabs
and the tree still work, since their behaviour is in the components, but nothing lays out the
forms: steps are a plain list, stats a list of bold values.
