# Task queue

A small queue that runs **async tasks** with retries and a _timeout_.

## Install

```sh
npm install @acme/queue
```

## Use

1. Create a queue with a logger.
2. Add tasks; each has an `id` and a `run` function.
3. Call `drain()` and read the statuses.

```ts
const queue = new TaskQueue(console)
queue.add({ id: 'fetch-users', run: () => fetch('/users') })
```

> [!NOTE]
> Tasks run one after another; `concurrency` is reserved.

- [x] Retries
- [ ] Priorities

See the [changelog](CHANGELOG.md) or <https://example.com/docs>.

---

| Option | Default |
| --- | --- |
| `retries` | 3 |
