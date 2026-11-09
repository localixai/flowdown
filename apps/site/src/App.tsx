import { useEffect, useState } from 'react'
import { pageFor } from './content'
import { DocPage } from './DocPage'
import { headFor } from './head'
import { PLAYGROUND_ROUTE } from './lib/routes'
import { Playground } from './Playground'
import { Link, Router, useLocation } from './router'
import { Search } from './Search'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

function NotFound() {
  return (
    <div className="doc">
      <article className="doc-article not-found">
        <h1>Page not found</h1>
        <p>
          <Link href="/">Back to the introduction</Link>
        </p>
      </article>
    </div>
  )
}

function Content() {
  const { route } = useLocation()
  // Open for the route it was opened on: navigating elsewhere closes it without an effect.
  const [menuAt, setMenuAt] = useState<string | null>(null)
  const menu = menuAt === route
  const page = pageFor(route)

  // Navigation in place changes the title and description the server set for the first page.
  useEffect(() => {
    const head = headFor(route)
    document.title = head.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', head.description)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', head.canonical)
  }, [route])

  return (
    <div className="shell" data-menu={menu || undefined}>
      <header className="topbar">
        <button
          type="button"
          className="menu-button"
          aria-expanded={menu}
          aria-controls="site-sidebar"
          aria-label="Menu"
          onClick={() => setMenuAt((open) => (open === route ? null : route))}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <Link href="/" className="brand">
          llx-markdown
        </Link>
        <Search />
        <ThemeToggle />
      </header>
      <div className="sidebar-wrap" id="site-sidebar">
        <Sidebar onNavigate={() => setMenuAt(null)} />
      </div>
      <main className="main" id="main">
        {route === PLAYGROUND_ROUTE ? (
          <Playground />
        ) : page ? (
          <DocPage key={page.route} page={page} />
        ) : (
          <NotFound />
        )}
      </main>
    </div>
  )
}

export function App({ route }: { route: string }) {
  return (
    <Router initialRoute={route}>
      <Content />
    </Router>
  )
}
