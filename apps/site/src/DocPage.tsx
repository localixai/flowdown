import { useMemo, useState, type AnchorHTMLAttributes, type ReactElement } from 'react'
import { extractHeadings, type Components } from 'llx-markdown'
import { PAGES } from './content'
import { neighbours, resolveDocHref, type Page } from './lib/routes'
import { SiteMarkdown } from './markdown'
import { Link } from './router'
import { Toc } from './Toc'

function PageActions({ page }: { page: Page }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="page-actions">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(page.body).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? 'Copied' : 'Copy page as Markdown'}
      </button>
      <a href={page.markdownUrl}>View .md</a>
    </div>
  )
}

type AnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }
const linkComponents = new Map<string, (props: AnchorProps) => ReactElement>()

/**
 * The `a` override for a page: its relative `.md` links become site routes and outside links open
 * in a new tab. Cached per page, because the renderer redraws every block when `components`
 * changes; `node` (the hast element) is dropped so it never reaches the DOM.
 */
function linkFor(path: string) {
  let link = linkComponents.get(path)
  if (!link) {
    link = function DocLink({ node: _node, href, ...props }: AnchorProps) {
      const target = href ? resolveDocHref(href, path, PAGES) : href
      const external = !!target && /^https?:/.test(target)
      return (
        <Link
          href={target}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          {...props}
        />
      )
    }
    linkComponents.set(path, link)
  }
  return link
}

/** One documentation page: its actions, the article, prev and next, and its outline beside it. */
export function DocPage({ page }: { page: Page }) {
  const headings = useMemo(() => extractHeadings(page.body), [page.body])
  const { prev, next } = neighbours(PAGES, page.route)
  const components = useMemo<Components>(() => ({ a: linkFor(page.path) }), [page.path])

  return (
    <div className="doc">
      <article className="doc-article">
        <PageActions page={page} />
        <SiteMarkdown headingIds components={components} className="doc-markdown">
          {page.body}
        </SiteMarkdown>
        <nav className="pager" aria-label="Pages">
          {prev ? (
            <Link href={prev.route} className="pager-prev">
              <span>Previous</span>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={next.route} className="pager-next">
              <span>Next</span>
              {next.title}
            </Link>
          ) : null}
        </nav>
      </article>
      <aside className="doc-aside">
        <Toc headings={headings} />
      </aside>
    </div>
  )
}
