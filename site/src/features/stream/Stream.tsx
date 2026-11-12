import { type Highlighter, Markdown } from '@localix-ai/flowdown';
import { useEffect, useState } from 'react';
import { TerminalReply } from './TerminalReply';
import { useStream } from './use-stream';
import './Stream.css';

const loadMermaid = () => import('mermaid');
// KaTeX's stylesheet comes with the stage: a page with no formula loads neither.
const loadMath = () => {
  void import('katex/dist/katex.min.css');
  return import('@localix-ai/flowdown/math');
};

/** The highlighter, loaded after the page: until then code is drawn plain. */
function useHighlighter() {
  const [highlight, setHighlight] = useState<Highlighter | null>(null);
  useEffect(() => {
    let alive = true;
    void import('@localix-ai/flowdown/highlight').then((module) => {
      if (alive) setHighlight(() => module.highlight);
    });
    return () => {
      alive = false;
    };
  }, []);
  return highlight;
}

/**
 * A reply streamed into the page and drawn by flowdown as it grows: the product itself, not a
 * recording of it. On a `page` it is `<Markdown>`; in a `terminal` it is the rows `@localix-ai/flowdown/tui`
 * makes of the same text, at the columns the frame has. `rich` loads Mermaid and KaTeX for a
 * reply that holds a diagram or a formula.
 */
export function Stream({ text, label, target = 'page', rich = false }: { text: string; label: string; target?: 'page' | 'terminal'; rich?: boolean }) {
  const stream = useStream(text);
  const highlight = useHighlighter();
  const arrived = text.slice(0, stream.shown);
  return (
    <>
      <div {...stream.frame} className={target === 'terminal' ? 'stream stream-terminal' : 'stream'} role="region" aria-label={label}>
        {target === 'terminal' ? (
          <TerminalReply text={arrived} streaming={stream.streaming} highlight={highlight} />
        ) : (
          <Markdown streaming={stream.streaming} highlight={highlight} {...(rich ? { mermaid: loadMermaid, math: loadMath } : {})} className="stream-reply">
            {arrived}
          </Markdown>
        )}
      </div>
      <div className="stream-caption">
        <span>{stream.progress}</span>
        <button type="button" onClick={stream.toggle}>
          {stream.action}
        </button>
      </div>
    </>
  );
}
