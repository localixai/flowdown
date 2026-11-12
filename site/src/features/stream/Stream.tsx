import { type Highlighter, Markdown } from 'flowdown';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './Stream.css';

/** Characters a second: about what a fast model sends. */
const RATE = 190;
/** How near its end the frame must be scrolled to keep following the reply. */
const NEAR = 32;

type Status = 'whole' | 'playing' | 'paused' | 'ended';

/**
 * A reply streamed into the page and drawn by flowdown as it grows: the product itself, not a
 * recording of it. The build writes the whole reply into the HTML, so it is read without script;
 * the page then plays it from its first character once it is seen, and holds the frame at the
 * reply's end as a chat does, unless the reader scrolled back. With reduced motion it stays whole.
 * The highlighter loads after the page: until then code is drawn plain.
 */
export function Stream({ text, label }: { text: string; label: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [shown, setShown] = useState(text.length);
  const [status, setStatus] = useState<Status>('whole');
  const [highlight, setHighlight] = useState<Highlighter | null>(null);

  useEffect(() => {
    let alive = true;
    void import('flowdown/highlight').then((module) => {
      if (alive) setHighlight(() => module.highlight);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Seen for the first time: play from the start.
  useEffect(() => {
    const node = frame.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        seen.disconnect();
        setShown(0);
        setStatus('playing');
      },
      { threshold: 0.3 },
    );
    seen.observe(node);
    return () => seen.disconnect();
  }, []);

  // The clock: the characters shown follow the time played, whatever the frame rate.
  useEffect(() => {
    if (status !== 'playing') return;
    let frameId = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      carry += ((now - last) / 1000) * RATE;
      last = now;
      const step = Math.floor(carry);
      carry -= step;
      if (step > 0) setShown((at) => Math.min(text.length, at + step));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [status, text.length]);

  useEffect(() => {
    if (status === 'playing' && shown >= text.length) setStatus('ended');
  }, [shown, status, text.length]);

  useLayoutEffect(() => {
    const node = frame.current;
    if (node && follow.current && status !== 'whole') node.scrollTop = node.scrollHeight;
  }, [shown, status]);

  const toggle = () => {
    if (status === 'playing') return setStatus('paused');
    if (status === 'paused') return setStatus('playing');
    follow.current = true;
    setShown(0);
    setStatus('playing');
  };

  return (
    <>
      <div
        ref={frame}
        className="stream"
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={(event) => {
          const node = event.currentTarget;
          follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR;
        }}
      >
        <Markdown streaming={status === 'playing' || status === 'paused'} highlight={highlight} className="stream-reply">
          {text.slice(0, shown)}
        </Markdown>
      </div>
      <div className="stream-caption">
        <span>
          {status === 'whole' || status === 'ended' ? `${text.length.toLocaleString('en-US')} characters` : `${shown.toLocaleString('en-US')} of ${text.length.toLocaleString('en-US')} characters`}
        </span>
        <button type="button" onClick={toggle}>
          {status === 'playing' ? 'Pause' : status === 'paused' ? 'Play' : 'Replay'}
        </button>
      </div>
    </>
  );
}
