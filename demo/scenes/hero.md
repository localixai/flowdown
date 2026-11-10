Postgres or SQLite for a side project?
---
> [!TABS]
#### SQLite
> [!PROS]
- one file, nothing to run
- backups are a copy

> [!CONS]
- one writer at a time

#### PostgreSQL
> [!PROS]
- concurrent writes
- extensions: full-text, `pgvector`

> [!CONS]
- a server to run

---

> [!STATS]
- **0** servers to run
- **~1 ms** a local read
- **281 TB** largest database

Start with **SQLite**; move when writes from several processes become the norm.
