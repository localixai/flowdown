import type { SiteConfig } from '@/shared/config';

// What the site knows about itself.
const GITHUB = 'https://github.com/localixai/flowdown';
const CHANGELOG = `${GITHUB}/blob/main/packages/flowdown/CHANGELOG.md`;
const DESCRIPTION =
  'flowdown is streaming Markdown for React and AI replies: its own parser, no dependencies, and a dialect of steps, tabs, figures, diagrams and math, drawn while the text arrives.';

const site: SiteConfig = {
  name: 'flowdown',
  title: 'flowdown — streaming Markdown for React and AI replies',
  description: DESCRIPTION,
  url: 'https://flowdown.dev',
  github: GITHUB,
  install: [
    ['npm', 'npm install @localix-ai/flowdown'],
    ['pnpm', 'pnpm add @localix-ai/flowdown'],
    ['bun', 'bun add @localix-ai/flowdown'],
    ['yarn', 'yarn add @localix-ai/flowdown'],
  ],
  image: { path: '/og.png', alt: 'flowdown: streaming Markdown for React and AI replies, with one reply drawn on a page and in a terminal' },
  bar: {
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Syntax', href: '/docs/syntax' },
      { label: 'Changelog', href: CHANGELOG },
      { label: 'GitHub', href: GITHUB },
    ],
    action: { label: 'Get started', href: '/#start' },
  },
  maker: { label: 'Localix Lab', href: 'https://localix.ai' },
  footer: {
    note: 'flowdown is MIT-licensed and open source.',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'npm', href: 'https://www.npmjs.com/package/@localix-ai/flowdown' },
      { label: 'GitHub', href: GITHUB },
      { label: 'Changelog', href: CHANGELOG },
    ],
  },
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: 'flowdown',
    description: DESCRIPTION,
    codeRepository: GITHUB,
    programmingLanguage: 'TypeScript',
    license: 'https://opensource.org/license/mit',
  },
  llms: '> flowdown is a Markdown renderer for React and AI replies: GitHub Markdown plus a dialect of steps, tabs, figures, callouts, sources, diagrams and math, drawn while the text streams.',
};

export default site;
