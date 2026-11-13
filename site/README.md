# flowdown.dev

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
