---
title: Styling
description: Recolour flowdown with CSS tokens, follow your page's light and dark mode, and restyle any element of the dialect.
---

# Styling

```ts
import '@localix-ai/flowdown/styles.css'
```

One stylesheet, about 4 KB compressed, with no framework behind it. Every rule is scoped to the
`.flowdown` element the renderer draws, so it touches nothing else on the page.

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

Every colour, font and radius is a custom property. Set them on `.flowdown`, or on any
ancestor, to match your design system:

```css
.flowdown {
  --fd-fg: var(--foreground);
  --fd-bg: var(--background);
  --fd-border: var(--border);
  --fd-link: var(--primary);
  --fd-radius: var(--radius);
}
```

The defaults sit at zero specificity, so any rule that sets a token wins. A token you set once
holds in both themes; to give each theme its own value, use `light-dark()` as well.

> [!TABS]
### Text and surfaces
| Token | Used for |
| --- | --- |
| `--fd-fg` | Body text; panels are mixed from it. |
| `--fd-fg-soft` | Secondary text: a step's body, a quote. |
| `--fd-fg-faint` | Annotations: a step's "when", a tree comment, a code language. |
| `--fd-bg` | The ground the Markdown sits on; diagrams mix their fills over it. |
| `--fd-bg-solid` | What shows through a translucent `--fd-bg` (a glass panel); white when unset. Set it when your ground has alpha, or a dark glass panel draws light diagrams. |
| `--fd-border`, `--fd-border-subtle`, `--fd-border-strong` | Table rules, tab underlines, tree guides. |
| `--fd-veil`, `--fd-veil-strong` | Panels: callouts, stats, code blocks. Mixed from `--fd-fg`. |
| `--fd-link` | Links. |
| `--fd-focus` | Focus rings on tabs, tree rows, the copy button. |

### Status
| Token | Used for |
| --- | --- |
| `--fd-info` | `NOTE` callouts. |
| `--fd-success` | `TIP` callouts, the pros' marks. |
| `--fd-important` | `IMPORTANT` callouts. |
| `--fd-warning` | `WARNING` callouts. |
| `--fd-danger` | `CAUTION` callouts, the cons' marks. |

These colour glyphs and marks only, never a fill.

### Code
| Token | Used for |
| --- | --- |
| `--fd-code-bg`, `--fd-code-fg` | Code blocks. |
| `--fd-code-comment` | Comments. |
| `--fd-code-keyword` | Keywords. |
| `--fd-code-string` | Strings. |
| `--fd-code-number` | Numbers and literals. |
| `--fd-code-function` | Function and class names. |
| `--fd-code-type` | Types and built-ins. |
| `--fd-code-tag` | Markup tags. |

### Diagrams
| Token | Used for |
| --- | --- |
| `--fd-chart-1` … `--fd-chart-8` | Diagram series, in order: pie slices, chart lines, git branches. |

Diagrams read these tokens when they are drawn, so a diagram matches the page it sits on.

### Shape and type
| Token | Used for |
| --- | --- |
| `--fd-font-heading` | Headings. Inherits the page's font by default. |
| `--fd-font-mono` | Code, trees. |
| `--fd-radius`, `--fd-radius-small` | Panels; buttons and inline code. |
| `--fd-duration` | Hover and focus transitions. |
| `--fd-caret-color` | The streaming caret. The text colour by default. |

---

Body text uses the font of the page around it.

## Restyling an element

Every element the dialect adds has a class. Restyle one with a selector that starts at
`.flowdown`, as the package's own rules do:

```css
.flowdown .fd-step-title { font-size: 1.05rem; }
.flowdown .fd-tab[aria-selected='true'] { color: var(--brand); }
```

| Form | Classes |
| --- | --- |
| Every form | `.fd-form`; a titled form has `.fd-steps-title`, `.fd-tabs-title`, `.fd-stats-title` or `.fd-sources-title` above it |
| Callout | `.fd-callout[data-callout="warning"]`, `.fd-callout-icon`, `.fd-callout-title`, `.fd-callout-body` |
| Steps | `.fd-steps`, `.fd-step-head`, `.fd-step-title`, `.fd-step-meta`, `.fd-step-body` |
| Tabs | `.fd-tabs`, `.fd-tab-list`, `.fd-tab`, `.fd-tab-panel` |
| Stats | `.fd-stats`, `.fd-stat`, `.fd-stat-value`, `.fd-stat-label` |
| Pros and cons | `.fd-verdicts`, `.fd-verdict[data-verdict="pros"]`, `.fd-verdict-title`, `.fd-verdict-list` |
| Folded section | `.fd-details` and its `summary` (a `<details>` written as HTML takes the same rules) |
| Sources | `.fd-sources`, `.fd-source`, `.fd-source-title`, `.fd-source-host`, `.fd-source-note` |
| File tree | `.fd-tree`, `.fd-tree-row`, `.fd-tree-name`, `.fd-tree-comment` |
| Diagram | `.fd-diagram`, `.fd-diagram-canvas`; its toolbar `.fd-diagram-actions` of `.fd-diagram-action` buttons; the viewer `dialog.fd-diagram-viewer`, `.fd-diagram-viewer-bar`, `.fd-diagram-stage`, `.fd-diagram-viewer-canvas` |
| Code block | `.fd-code`, `.fd-code-bar`, `.fd-code-title`, `.fd-code-language` (absent when the fence names none), `.fd-code-download`, `.fd-code-copy` |

The root carries `data-streaming` while a reply streams, and `data-caret` while its caret shows.

The stylesheet is not in a cascade layer on purpose: a page's own reset for `button` or `ul`, in
no layer, would then win over the tabs and the lists. To replace an element outright rather than
restyle it, see [Components](components.md).

## Without the stylesheet

You can leave `styles.css` out and style the classes yourself; the markup is the same. The tabs
and the tree still work, since their behaviour is in the components, but nothing lays out the
forms: steps are a plain list, stats a list of bold values.
