// The docs pages' only script (their styles are docs.html's links). The pages are whole HTML from
// the build, with no React in the browser: this adds the code blocks' Copy, the tabs' switch, and marks the section
// being read in the table of contents. Without it a page reads the same.

import './docs-menus';

for (const button of document.querySelectorAll<HTMLButtonElement>('.fd-code-copy')) {
  const code = button.closest('.fd-code')?.querySelector('pre');
  if (!code) continue;
  let timer = 0;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
    } catch {
      return;
    }
    button.dataset.copied = '';
    button.setAttribute('aria-label', 'Copied');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      delete button.dataset.copied;
      button.setAttribute('aria-label', 'Copy code');
    }, 1600);
  });
}

// Tabs: a press or an arrow key shows a variant and hides the others.
for (const list of document.querySelectorAll<HTMLElement>('.fd-tab-list')) {
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('.fd-tab')];
  const show = (chosen: HTMLButtonElement) => {
    for (const tab of tabs) {
      const on = tab === chosen;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
      if (panel) panel.hidden = !on;
    }
  };
  list.addEventListener('click', (event) => {
    const tab = (event.target as Element).closest<HTMLButtonElement>('.fd-tab');
    if (tab) show(tab);
  });
  list.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const at = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const next = tabs[(at + step + tabs.length) % tabs.length];
    if (step === 0 || at < 0 || !next) return;
    event.preventDefault();
    show(next);
    next.focus();
  });
}

// The search: its button, Cmd or Ctrl+K, or `/` open it; its code comes only then.
const search = document.querySelector<HTMLDialogElement>('.search');
if (search) {
  let attached: Promise<unknown> | undefined;
  const open = () => {
    if (search.open) return;
    search.showModal();
    attached ??= import('./docs-search').then((module) => module.attach(search));
  };
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  for (const button of document.querySelectorAll<HTMLElement>('[data-search-open]')) {
    const key = button.querySelector('[data-search-key]');
    if (key && mac) key.textContent = '⌘K';
    button.hidden = false;
    button.addEventListener('click', open);
  }
  window.addEventListener('keydown', (event) => {
    const typing = (event.target as Element).closest?.('input, textarea, [contenteditable]');
    const chord = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (!chord && (event.key !== '/' || typing)) return;
    event.preventDefault();
    open();
  });
}

// A table or a code block wider than the column scrolls sideways: it is then a Tab stop, so the
// arrow keys can scroll it (WCAG 2.1.1). One that fits stays out of the Tab order. This is what
// flowdown does itself where it runs in the browser; these pages are HTML alone.
const scrollers = [...document.querySelectorAll<HTMLElement>('.fd-table, .flowdown pre')];
function reach(box: HTMLElement) {
  const scrolls = box.scrollWidth > box.clientWidth + 1;
  if (scrolls === box.hasAttribute('tabindex')) return;
  if (scrolls) {
    box.tabIndex = 0;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', box.localName === 'pre' ? 'Scrollable code' : 'Scrollable table');
  } else {
    box.removeAttribute('tabindex');
    box.removeAttribute('role');
    box.removeAttribute('aria-label');
  }
}
if (typeof ResizeObserver === 'undefined') scrollers.forEach(reach);
else {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) reach(entry.target as HTMLElement);
  });
  for (const box of scrollers) observer.observe(box);
}

const links = [...document.querySelectorAll<HTMLAnchorElement>('.docs-toc a')];
const sections = links.map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))));
let frame = 0;

/** The section being read is the last whose heading has passed the top fifth of the window, or
 *  the last one once the page is scrolled to its end. */
function mark() {
  frame = 0;
  const line = window.innerHeight / 5;
  const end = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  let at = 0;
  sections.forEach((section, index) => {
    if (section && section.getBoundingClientRect().top < line) at = index;
  });
  if (end) at = sections.length - 1;
  links.forEach((link, index) => {
    if (index === at) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

if (links.length > 0) {
  window.addEventListener('scroll', () => (frame ||= window.requestAnimationFrame(mark)), { passive: true });
  mark();
}
