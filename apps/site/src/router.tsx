import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { normalizeRoute } from './lib/routes'

interface Location {
  route: string
  navigate: (href: string) => void
}

const RouterContext = createContext<Location>({ route: '/', navigate: () => {} })

export const useLocation = () => useContext(RouterContext)

function scrollToHash(hash: string) {
  const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null
  if (target) target.scrollIntoView()
  else window.scrollTo(0, 0)
}

/**
 * The site's whole router: the route is the path, a link pushes history, Back and Forward pop
 * it. The server renders with the route it was asked for; the client starts from the address bar.
 */
export function Router({ initialRoute, children }: { initialRoute: string; children: ReactNode }) {
  const [route, setRoute] = useState(initialRoute)

  useEffect(() => {
    const onPop = () => setRoute(normalizeRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((href: string) => {
    const url = new URL(href, window.location.href)
    const next = normalizeRoute(url.pathname)
    window.history.pushState(null, '', `${next}${url.hash}`)
    setRoute(next)
    // After the new page has rendered, so its headings exist.
    requestAnimationFrame(() => scrollToHash(url.hash))
  }, [])

  const value = useMemo(() => ({ route, navigate }), [route, navigate])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

const internal = (href: string | undefined) =>
  !!href && href.startsWith('/') && !href.startsWith('//') && !/\.(md|txt|xml)(#|$)/.test(href)

/** An `<a>` that navigates in place for the site's own pages and is a plain link otherwise. */
export function Link({
  href,
  onClick,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useLocation()
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || !internal(href)) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    navigate(href!)
  }
  return (
    <a href={href} onClick={handle} {...props}>
      {children}
    </a>
  )
}
