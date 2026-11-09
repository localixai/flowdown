import { NAV, PAGES } from './content'
import { PLAYGROUND_ROUTE } from './lib/routes'
import { Link, useLocation } from './router'

/** The navigation, section by section, with the current page marked. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { route } = useLocation()
  return (
    <nav className="sidebar" aria-label="Documentation">
      {NAV.sections.map((section) => {
        const pages = PAGES.filter((page) => page.section === section.title)
        if (pages.length === 0) return null
        return (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {pages.map((page) => (
                <li key={page.route}>
                  <Link
                    href={page.route}
                    aria-current={page.route === route ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <section>
        <h2>Try it</h2>
        <ul>
          <li>
            <Link
              href={PLAYGROUND_ROUTE}
              aria-current={route === PLAYGROUND_ROUTE ? 'page' : undefined}
              onClick={onNavigate}
            >
              Playground
            </Link>
          </li>
        </ul>
      </section>
    </nav>
  )
}
