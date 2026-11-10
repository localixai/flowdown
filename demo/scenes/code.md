Where does routing live?
---
```tree
my-app/
├── src/
│   ├── main.ts        # entry point
│   └── routes/
│       ├── index.ts   # the route table
│       └── users.ts
└── package.json
```

Each route is a function from a request to a response:

```ts
import { route } from './router'

export const users = route('/users/:id', async ({ params }) => {
  const user = await db.users.find(params.id)
  return user ? Response.json(user) : new Response('Not found', { status: 404 })
})
```

> [!TIP]
> `bun run routes` prints the table, with the file each route comes from.
