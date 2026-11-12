import type { Highlighter } from '@localix-ai/flowdown';
import { createTerminalView, type Line, type Style } from '@localix-ai/flowdown/tui';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

/** The columns the build draws for, before the page has measured its own. */
const COLUMNS = 64;

const classOf = (style: Style) =>
  [style.bold && 'b', style.dim && 'd', style.italic && 'i', style.underline && 'u', style.strike && 's', style.color]
    .filter(Boolean)
    .map((name) => `tty-${name}`)
    .join(' ');

/** One row. A row that did not change is the same object, so it is not drawn again. */
const Row = memo(function Row({ line }: { line: Line }) {
  return (
    <div>
      {line.length === 0
        ? '\n'
        : line.map((span, index) => {
            const name = classOf(span.style);
            return name ? (
              <span key={index} className={name}>
                {span.text}
              </span>
            ) : (
              span.text
            );
          })}
    </div>
  );
});

/**
 * A reply as a terminal draws it: the rows `@localix-ai/flowdown/tui` makes, each a list of styled runs, set
 * in the page's monospace. The view is the one a terminal program keeps for a streaming reply;
 * its width is the columns that fit the frame, measured from the font.
 */
export function TerminalReply({ text, streaming, highlight }: { text: string; streaming: boolean; highlight: Highlighter | null }) {
  const screen = useRef<HTMLPreElement>(null);
  const [columns, setColumns] = useState(COLUMNS);
  const view = useMemo(() => createTerminalView({ width: COLUMNS, highlight }), [highlight]);

  useEffect(() => {
    const node = screen.current;
    if (!node) return;
    const measure = () => {
      const probe = document.createElement('span');
      probe.textContent = '0'.repeat(20);
      probe.style.visibility = 'hidden';
      node.append(probe);
      const column = probe.getBoundingClientRect().width / 20;
      probe.remove();
      if (column > 0) setColumns(Math.max(24, Math.floor(node.clientWidth / column)));
    };
    const sized = new ResizeObserver(measure);
    sized.observe(node);
    void document.fonts.ready.then(measure);
    return () => sized.disconnect();
  }, []);

  const lines = view.render(text, { streaming, width: columns });
  return (
    <pre ref={screen} className="tty">
      {lines.map((line, index) => (
        <Row key={index} line={line} />
      ))}
    </pre>
  );
}
