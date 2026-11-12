# AGENTS.md

Instructions for AI coding agents working on this repository.

This is flowdown's site: the landing and the documentation at flowdown.dev. It began as a copy of
llx-sitekit and is now this repository's own: there is no template to merge from.

## Rules

- **Know where the words are.** What the site says is `content/` (`site.ts`, `landing.ts`,
  `reply.md`, `theme.css`) and `public/`. The docs are the repository's own `../docs/`, and the
  releases are `../packages/flowdown/CHANGELOG.md`: change them there, never a copy here.
- **The site draws with the workspace's flowdown.** Build the package (`bun run build` at the
  root) before the site; a claim or a figure on the landing must be one the repository proves
  (`bench/results`, `docs/comparison.md`, `bun run size`).
- **Feature-Sliced Design, strictly.** Layers: `app` → `pages` → `widgets` → `features` →
  `entities` → `shared`. Import only downward, never between slices of one layer, and only
  through a slice's `index.ts`. `npm run lint` checks it; never work around it.
- **Tokens only.** A colour, a font, the radius and the gutter are custom properties of
  `src/shared/styles/global.css` and `syntax.css`; the lint refuses a hex colour in any other
  stylesheet. Styles are plain CSS beside the component, with class names that start with the
  component's own.
- **The docs stay static.** Nothing a browser loads may import `entities/doc`. A docs page gets
  only `src/app/entry-docs.ts`.
- **Content is data.** Copy never lives in a component: a landing section is a field of
  `LandingContent` in `src/shared/config/types.ts`, a widget, and a line in
  `src/pages/landing/LandingPage.tsx`.
- **A component has a specimen.** Anything added to `src/shared/ui`, `features/` or `widgets/`
  is shown on the kit page (`src/pages/kit/Components.tsx`); a new token is listed in
  `src/pages/kit/tokens.ts`.
- **Accessible by construction.** Text at least 4.5:1 on its ground (the kit page measures it),
  everything pressable a link or a button with the one focus ring, targets at least 36 px,
  nothing moving under `prefers-reduced-motion`, no sideways scroll at 390 px.
- No file over 300 lines. Comments say why. English only.
- **Docs follow the standard.** A page of `../docs/` is a file named in lower-case words joined
  by hyphens, one `#` title, a paragraph after it (its description), sections `##` then `###`
  with no level skipped, and its name once in `content/docs/nav.ts`. Link to another page by its file
  (`streaming.md#repair`). The build refuses anything else and makes the menu, the index, the
  search, the sitemap, `llms.txt` and the landing's list from it: never write one by hand.

## How to

| Task | Where |
| --- | --- |
| Change what the site says | `content/site.ts`, `content/landing.ts`; the types in `src/shared/config/types.ts` say every field. |
| Change a reply the page streams | `content/reply.md` (the hero), `content/dialect.md`, `content/terminal.md` and `content/diagram.md` (the cards). |
| Add a docs page | A file in `../docs/`, its name in `content/docs/nav.ts`. |
| Change a colour or a shape | `content/theme.css`, then `src/shared/styles/global.css`. |
| Add a section to the landing | A field of `LandingContent`, a widget in `src/widgets/`, a line in `LandingPage.tsx`, a specimen on the kit page. |
| Redraw the link preview | Edit `public/og-card.html`, render it at 1200×630 to `public/og.png`. |
| Publish | `bun run deploy` (Cloudflare Pages, project `flowdown`). |

## Before you say it is done

```sh
npm run check
```

A failure names the file and the rule; fix what it names, never the check. Then look at what you changed at a phone's width (390 px) and a laptop's: `npm run dev`, the
landing, a docs page, and `/kit`. The checks do not see the page.
