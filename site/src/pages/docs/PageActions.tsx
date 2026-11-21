import type { DocPage } from '@/entities/doc';
import { SITE } from '@/shared/config';
import { Check, ChevronDown, Copy } from '@/shared/ui';

/** The question an assistant is opened with: the page's markdown to read, then the reader's turn. */
const ask = (markdown: string) => `Read ${markdown} so I can ask questions about it.`;

/** Under a page's title: the page as markdown, for an assistant. "Copy page" puts it on the
 *  clipboard; the menu beside it shows it, or opens Claude or ChatGPT with it. The menu is links,
 *  so it works with no script; copying needs the page's script, and shows only with it. */
export function PageActions({ page }: { page: DocPage }) {
  const markdown = `${SITE.url}${page.route}.md`;
  const question = encodeURIComponent(ask(markdown));
  const rows = [
    { href: `${page.route}.md`, label: 'View as Markdown', hint: 'This page as plain text' },
    { href: `https://claude.ai/new?q=${question}`, label: 'Open in Claude', hint: 'Ask questions about this page' },
    { href: `https://chatgpt.com/?q=${question}`, label: 'Open in ChatGPT', hint: 'Ask questions about this page' },
  ];
  return (
    <div className="page-actions">
      <button type="button" className="page-actions-copy" data-copy-page={`${page.route}.md`} hidden>
        <Copy />
        <Check />
        <span aria-live="polite">Copy page</span>
      </button>
      <button type="button" className="page-actions-more" popoverTarget="page-actions" aria-label="More ways to read this page">
        <ChevronDown />
      </button>
      <div id="page-actions" popover="auto" className="menu menu-end page-actions-menu" aria-label="This page for an assistant">
        <ul>
          <li data-copy-row hidden>
            <button type="button" data-copy-page={`${page.route}.md`}>
              <span>
                Copy page
                <small>As markdown, for an assistant</small>
              </span>
            </button>
          </li>
          {rows.map((row) => (
            <li key={row.label}>
              <a href={row.href} {...(row.href.startsWith('https:') ? { target: '_blank', rel: 'noopener' } : {})}>
                <span>
                  {row.label}
                  <small>{row.hint}</small>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
