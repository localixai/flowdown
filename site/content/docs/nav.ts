import type { DocsConfig } from '@/shared/config';

// The docs' table of contents. The pages are the repository's own `docs/`, as GitHub shows them:
// every markdown file there is a page listed here, in a group, or is named under `unlisted` with
// why. A file in neither fails the build.
const docs: DocsConfig = {
  index: {
    title: 'flowdown docs',
    description:
      'How to render a streaming reply with flowdown: the dialect a model writes, the React component, the targets outside React, and the reference.',
  },
  groups: [
    {
      title: 'Start',
      blurb: 'What flowdown is, a first reply on the page, and how it compares.',
      pages: ['introduction', 'getting-started', 'comparison'],
    },
    {
      title: 'Writing',
      blurb: 'The forms a model can write, the prompt that teaches them, and what the parser passes.',
      pages: ['syntax', 'prompting', 'conformance'],
    },
    {
      title: 'Rendering',
      blurb: 'A reply while it streams, its look, its components, and what a reply may not do.',
      pages: ['streaming', 'styling', 'components', 'math', 'diagrams', 'highlighting', 'security'],
    },
    {
      title: 'Beyond React',
      blurb: 'The same reply as HTML text, a page, a custom element or a terminal, and in a remark pipeline.',
      pages: ['targets', 'remark'],
    },
    {
      title: 'Recipes',
      blurb: 'A chat on the AI SDK, a docs site, and moving from another renderer.',
      pages: ['recipes/ai-sdk', 'recipes/docs-site', 'recipes/migrating'],
    },
    {
      title: 'Reference',
      blurb: 'Every export of every entry.',
      pages: ['api'],
    },
  ],
  unlisted: {},
};

export default docs;
