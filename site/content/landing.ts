import type { Block, Card, LandingContent, Media, Tone } from '@/shared/config';
import reply from './reply.md?raw';

// The landing's words. Every figure is one of the repository's: bench/results and docs/comparison.md.
const DOCS = '/docs';
const GITHUB = 'https://github.com/rsaryev/flowdown';

const out = (text: string, tone: Tone = 'hi'): Block => ({ out: text, tone });
const terminal = (blocks: Block[], label: string): Media => ({ kind: 'terminal', blocks, label });

const CARDS: Card[] = [
  {
    tag: 'Streaming',
    title: 'Nothing half-written reaches the reader',
    text: 'A reply arrives mid-word. Unfinished `**bold`, a half-typed link and an open code fence are repaired as they come, so raw syntax never shows and nothing flickers when it closes.',
    links: [{ href: `${DOCS}/streaming`, label: 'How streaming works' }],
    media: terminal(
      [
        {
          grid: [
            [['dim', 'arrives'], ['dim', 'is drawn as']],
            [['hi', 'The **answer is'], ['ok', 'The answer is  (bold)']],
            [['hi', 'see [the gui'], ['ok', 'see the gui']],
            [['hi', '```ts⏎const a ='], ['ok', 'a code block, still open']],
            [['hi', '| a | b |⏎| -'], ['ok', 'a table, its first row']],
            [['hi', '$$ \\frac{1'], ['ok', 'held until it can be set']],
          ],
        },
        out('only the block being written is parsed again', 'dim'),
      ],
      'What a reader sees of a reply that is still arriving',
    ),
  },
  {
    tag: 'Dialect',
    title: 'Forms a model can write and a reader can scan',
    text: 'Steps, tabs, headline figures, the case for and against, callouts, folded sections, sources and file trees, on top of GitHub Markdown. Each is a quote line and a list: where it is not rendered, it still reads.',
    links: [
      { href: `${DOCS}/syntax`, label: 'The syntax' },
      { href: `${DOCS}/prompting`, label: 'The prompt that teaches it' },
    ],
    media: {
      kind: 'image',
      src: '/media/steps.png',
      alt: 'A reply drawn as numbered steps on one line, with code under a step and tabs after them',
      width: 1520,
      height: 994,
    },
  },
  {
    tag: 'Speed',
    title: 'A long reply costs what a short one does',
    text: 'A 100k-character reply streams in 0.13 s of main-thread time; the next fastest of six React renderers takes 2.3 s. No update takes more than 5 ms, so a stream never drops a frame.',
    links: [
      { href: `${DOCS}/comparison`, label: 'The comparison' },
      { href: `${GITHUB}/tree/main/bench`, label: 'The benchmark' },
    ],
    media: terminal(
      [
        {
          align: 'lrrr',
          grid: [
            [['dim', 'streaming, ms'], ['dim', 'chat 5k'], ['dim', 'code 50k'], ['dim', 'answer 100k']],
            [['ok', 'flowdown'], ['ok', '10'], ['ok', '35'], ['ok', '132']],
            [['hi', 'markdown-to-jsx'], ['', '14'], ['', '56'], ['', '2,293']],
            [['hi', 'markstream'], ['', '40'], ['', '944'], ['', '5,522']],
            [['hi', 'Streamdown'], ['', '51'], ['', '4,960'], ['', '6,265']],
            [['hi', 'marked-react'], ['', '36'], ['', '78'], ['', '7,371']],
            [['hi', 'react-markdown'], ['', '204'], ['', '2,871'], ['bad', 'stopped']],
          ],
        },
        out('31.7 KB gzipped, one package, no dependencies', 'dim'),
      ],
      'Main-thread time to stream a reply, in milliseconds, for six React renderers',
    ),
  },
  {
    tag: 'Targets',
    title: 'The same reply outside React',
    text: 'As HTML text on a server, in a page with no framework, as a `<flow-down>` element, or as the rows of a terminal. One parser draws them all, and none of these entries imports React.',
    links: [{ href: `${DOCS}/targets`, label: 'The targets' }],
    media: {
      kind: 'video',
      src: '/media/terminal.mp4',
      poster: '/media/terminal.jpg',
      label: 'A reply streaming in a terminal: callouts, steps, tabs, a file tree, highlighted code, a table and a formula drawn as styled text',
      width: 1240,
      height: 846,
    },
  },
  {
    tag: 'Diagrams and math',
    title: 'A diagram a reader can open',
    text: 'A `mermaid` fence is drawn once it is whole, in the page’s colours, and opens in a viewer that zooms and pans. Formulas are set by KaTeX. Both load only for a reply that has one.',
    links: [
      { href: `${DOCS}/diagrams`, label: 'Diagrams' },
      { href: `${DOCS}/math`, label: 'Math' },
    ],
    media: {
      kind: 'video',
      src: '/media/diagram.mp4',
      poster: '/media/diagram.jpg',
      label: 'A diagram in a reply opened in the viewer, zoomed and panned',
      width: 1520,
      height: 1300,
    },
  },
  {
    tag: 'Safety',
    title: 'A reply cannot act on the page',
    text: 'A model’s text is untrusted. Raw HTML is parsed and sanitized, scripts and handlers are dropped, and a link keeps only a safe protocol. It needs no setup and no second library.',
    links: [{ href: `${DOCS}/security`, label: 'What is allowed' }],
    media: terminal(
      [
        out('the reply', 'dim'),
        out('<img src=x onerror="steal()">'),
        out('[click](javascript:alert(1))'),
        out("<script>fetch('/token')</script>"),
        out('the page', 'dim'),
        out('<img src="x"/>', 'ok'),
        out('<p><a>click</a></p>', 'ok'),
        out('(nothing)', 'ok'),
      ],
      'A hostile reply, and the HTML flowdown makes of it',
    ),
  },
];

const landing: LandingContent = {
  hero: {
    title: { chip: 'Markdown', after: '', rest: 'that draws while the model is still writing' },
    lede: 'flowdown renders an AI reply in React as it streams: GitHub Markdown plus steps, tabs, figures, diagrams and math. Its own parser, no dependencies, 31.7 KB.',
    under: 'React 18 and 19 · MIT · [Docs](/docs) · also [outside React](/docs/targets)',
    stream: {
      text: reply,
      label: 'A reply streaming into the page, drawn by flowdown as it arrives: a callout, numbered steps with code, headline figures, tabs, a table, pros and cons, and sources',
    },
  },
  loop: {
    title: 'Built for a reply, not a document',
    aside: 'Six things it does',
    cards: CARDS,
  },
  docs: { title: 'Documentation' },
  releases: { title: 'Releases', more: { label: 'Full changelog', href: `${GITHUB}/blob/main/packages/flowdown/CHANGELOG.md` } },
  closing: {
    title: 'Start in three steps',
    aside: 'Free · MIT license',
    steps: [
      { title: 'Install', text: '`npm install flowdown`. React is its only peer, and only for `<Markdown>`.' },
      { title: 'Render', text: 'Import `flowdown/styles.css` once, then `<Markdown streaming={!done}>{text}</Markdown>`.' },
      { title: 'Teach the model', text: 'Add `answerFormatPrompt()` from `flowdown/prompt` to the system prompt.' },
    ],
    links: [
      { label: 'Get started', href: `${DOCS}/getting-started` },
      { label: 'Source on GitHub', href: GITHUB },
    ],
  },
};

export default landing;
