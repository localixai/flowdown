# flowdown.localix.ai

The landing page and the documentation of flowdown. The docs it shows are the repository's
[`docs/`](../docs), the releases are the package's [changelog](../packages/flowdown/CHANGELOG.md),
and every page is drawn by the workspace's own `flowdown`: the landing streams a reply with it.

```sh
bun install            # at the repository's root
bun run build          # at the root: the site draws with the built package
cd site
bun run dev            # http://localhost:5173
```

## Commands

| Command | |
| --- | --- |
| `bun run dev` | The site, with the docs rendered as the build writes them. |
| `bun run check` | Lint, types, build, the docs' links. Run it before every deploy. |
| `bun run build` | The static site, in `dist/`. |
| `bun run preview` | Serve `dist/`. |
| `bun run deploy` | Build and publish `dist/` to Cloudflare Pages by hand; a push to main does it itself (`.github/workflows/site.yml`). |

## Where things are

| Path | |
| --- | --- |
| `content/` | What the site says: `site.ts`, `landing.ts`, the replies it streams (`reply.md`, `dialect.md`, `terminal.md`, `diagram.md`), `theme.css`. |
| `public/` | The icons, the link preview and its source, the landing's clips, `llms.txt`, `robots.txt`. |
| `../docs/` | The documentation; its menu is `content/docs/nav.ts`. |
| `src/`, `scripts/` | Components, styles, the docs engine and the build, in Feature-Sliced layers (`bun run lint` enforces them). |

The design system, every token and component as the pages draw them, is at `/kit`.

## Usage statistics

The site can count its visits with Google Analytics 4, loaded only after a visitor says yes on a
small card. It is off: without `analytics` in `content/site.ts` the pages have no card, no
"Cookie settings" in the footer and no tag. To turn it on:

```ts
analytics: {
  ga4: 'G-XXXXXXXXXX', // the GA4 web stream's measurement id; a malformed one fails the build
  notice: 'We count visits with Google Analytics, only with your yes, to see which pages help.',
  privacy: 'https://localix.ai/privacy', // optional: the card links to it
},
```

- **The card** sits over the page's lower left corner (across it on a phone), with two equal
  answers, "No thanks" and "Allow". It takes no focus and moves nothing. A browser that sends
  Global Privacy Control sees no card: that counts as a no until the visitor says yes from the
  footer.
- **The answer** is a cookie, `analytics_consent`, on the registrable domain (`localix.ai` for
  every site under it, so a visitor is asked once), kept a year. "Cookie settings" in the footer
  opens the card again on every page; a no after a yes stops measuring and removes `_ga` and
  `_ga_<id>`.
- **Before a yes** nothing of Google's is in the page: no script, no `dataLayer`, no cookie, no
  request (basic consent mode). The advertising signals are denied in every consent command, and
  Google signals and ad personalisation are off.
- **The site's own events** (`src/shared/analytics/events.ts`, a closed registry: a value is a
  member of a closed set or a boolean, never free text): `install_copied` with `method`, the
  install tab's label; `code_copied`, a docs code block copied; `docs_searched` with `found`,
  when the docs' search closes or leaves for a result on another page after a query. The query
  itself is never sent.
- **`bun run lint`** fails when Google's tag, its queue or its host is named outside
  `src/shared/analytics/google-tag.ts`, or in any page's HTML.

In Google Analytics: register `method` and `found` as event-scoped custom dimensions, mark
`install_copied` a key event, turn off enhanced measurement's site search and form interactions,
and leave Google signals off.
