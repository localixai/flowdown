# What each renderer draws

The same inputs through every renderer, configured as its README sets up a chat, with no plugins; each mark is a check on the DOM it drew ([src/features.tsx](../src/features.tsx)). The markup behind every mark is in [features.json](features.json). Regenerate with `bun run features`.

| | llx 0.1.0 | streamdown 2.7.1 | react-markdown 10.1.0 | markdown-to-jsx 9.10.6 | markstream 2.0.24 | marked-react 4.0.0 |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| **GitHub Markdown** |  |  |  |  |  |  |
| Tables | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Task lists | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Strikethrough | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Footnotes | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Bare links (autolinks) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alerts (`> [!WARNING]`) | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Raw HTML (`<kbd>`) | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **While streaming** |  |  |  |  |  |  |
| Unfinished bold shows as bold | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Unclosed code fence shows as code | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Half-typed link shows its text, no brackets | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| Half-typed table row shows no pipes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Safety** |  |  |  |  |  |  |
| Drops `onerror` and other handlers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Drops `javascript:` links | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Never mounts `<script>` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Rendering** |  |  |  |  |  |  |
| Renders on the server (`renderToString`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
