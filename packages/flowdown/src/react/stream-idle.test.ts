import { expect, test } from 'bun:test'

/**
 * Work React is left to do after a token is drawn: the tasks its scheduler posts, for effects and
 * the renders they cause. Counted in a process of its own, where `setImmediate` is wrapped before
 * React DOM is loaded (the scheduler reads it once); other test files load React DOM first.
 */
const tasksPerToken = (props: string): { mount: number; tokens: number; perToken: number } => {
  const script = `
    import { GlobalRegistrator } from '@happy-dom/global-registrator'
    GlobalRegistrator.register({ url: 'https://example.test/' })
    let queued = 0
    const original = globalThis.setImmediate
    globalThis.setImmediate = Object.assign((callback, ...args) => {
      queued += 1
      return original(callback, ...args)
    }, original)
    const { createElement } = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { flushSync } = await import('react-dom')
    const { Markdown } = await import('./markdown')
    const reply = '# A reply\\n\\nSome **bold** text and a [link](https://example.com).\\n\\n- one\\n- two\\n\\nThe end, with \`code\` in it.'
    const root = createRoot(document.createElement('div'))
    const drain = () => new Promise((done) => original(done))
    flushSync(() => root.render(createElement(Markdown, { streaming: true, ${props} }, reply.slice(0, 1))))
    await drain()
    const mount = queued
    let tokens = 0
    for (let end = 2; end <= reply.length; end += 1) {
      flushSync(() => root.render(createElement(Markdown, { streaming: true, ${props} }, reply.slice(0, end))))
      tokens += 1
      // A page's event loop turns between two tokens: what the commit queued runs here.
      await drain()
    }
    const perToken = (queued - mount) / tokens
    root.unmount()
    console.log(JSON.stringify({ mount, tokens, perToken }))
    process.exit(0)
  `
  const run = Bun.spawnSync(['bun', '-e', script], {
    cwd: import.meta.dir,
    env: { ...process.env, NODE_ENV: 'production' },
  })
  if (run.exitCode !== 0) throw new Error(run.stderr.toString())
  return JSON.parse(run.stdout.toString())
}

test('a token leaves React no work to do afterwards, when nothing on the page needs it', () => {
  // No stage to load (no math, no rare entity, HTML read with what is built in) and no smoothing:
  // every token is drawn in its commit, with no effect queued behind it. React itself queues one
  // after a commit that removes a node it drew, to let go of it: here once, when `**bold**` closes
  // and the `*` drawn while it was open goes. Before, every token queued one.
  expect(tasksPerToken('').perToken).toBeLessThan(0.05)
})

test('smoothing still schedules its catching up', () => {
  // The count can see work when there is some: the pacer runs after the commit that grew the text.
  expect(tasksPerToken('smooth: true').perToken).toBeGreaterThan(0)
})
