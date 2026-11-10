import page from './page.html'

/** The demo page, bundled by Bun on request. */
export function serve(port = Number(process.env.PORT ?? 0)) {
  return Bun.serve({ port, routes: { '/': page }, development: false })
}

if (import.meta.main) console.log(`demo: ${serve(Number(process.env.PORT ?? 5195)).url}`)
