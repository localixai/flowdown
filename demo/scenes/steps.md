How do I roll back a bad deploy?
---
> [!STEPS] Roll back
1. **Find the last good release**
   `git log --oneline --first-parent main`
2. **Deploy it**
   ```sh
   bun run deploy --ref v1.4.2 --env production
   ```
3. **Check the health page**
   It turns green within a minute.

> [!WARNING] Migrations
> A rollback does not undo a migration. Run `bun run db:down` first if the release added one.
