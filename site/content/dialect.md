## Rolling back a deploy

> [!WARNING] Migrations
> A rollback does not undo a migration. Run `bun run db:down` first.

> [!STEPS]
1. **Find the last good release**
   `git log --oneline --first-parent main`
2. **Deploy it**
   `bun run deploy --ref v1.4.2`
3. **Check the health page**
   It turns green within a minute.

> [!STATS]
- **40 s** to roll back
- **0** requests dropped

```tree
deploy/
├── releases/
│   ├── v1.4.2/      # the last good one
│   └── v1.5.0/      # the bad one
└── current -> releases/v1.4.2
```

> [!DETAILS] Why not revert the commit?
> A revert builds and ships a new release, which takes minutes. A rollback points `current` at a
> release that is already built.

> Simplicity is prerequisite for reliability. — Edsger W. Dijkstra

- [x] rolled back
- [ ] write the incident note

> [!SOURCES] Read more
- [The dialect](/docs/syntax) — every form, as a model writes it
