import { type UIEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Characters a second: about what a fast model sends. */
const RATE = 190;
/** How near its end the reader must scroll the frame for it to follow the reply again. */
const NEAR = 4;

export type Status = 'whole' | 'playing' | 'paused' | 'ended';

/**
 * A text arriving as a model sends it, in a frame that scrolls. The build writes the whole text,
 * so it is read without script; the page plays it from its first character once it is seen, and
 * holds the frame at the text's end as a chat does, until the reader scrolls up: then it is
 * theirs, mid-stream too. With reduced motion it stays whole.
 */
export function useStream(text: string) {
  const frame = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const top = useRef(0);
  const touched = useRef(0);
  const [shown, setShown] = useState(text.length);
  const [status, setStatus] = useState<Status>('whole');

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
    if (node && follow.current && status === 'playing') node.scrollTop = node.scrollHeight;
  }, [shown, status]);

  const touch = () => {
    touched.current = performance.now();
  };
  const toggle = () => {
    if (status === 'playing') return setStatus('paused');
    if (status === 'paused') return setStatus('playing');
    follow.current = true;
    top.current = 0;
    setShown(0);
    setStatus('playing');
  };
  const count = (n: number) => n.toLocaleString('en-US');

  return {
    shown,
    streaming: status === 'playing' || status === 'paused',
    /** How much has arrived, in words. */
    progress: status === 'whole' || status === 'ended' ? `${count(text.length)} characters` : `${count(shown)} of ${count(text.length)} characters`,
    action: status === 'playing' ? 'Pause' : status === 'paused' ? 'Play' : 'Replay',
    toggle,
    /** What the scrolling frame takes. */
    frame: {
      ref: frame,
      tabIndex: 0,
      onWheel: touch,
      onTouchMove: touch,
      onKeyDown: touch,
      onPointerDown: touch,
      onPointerMove: (event: { buttons: number }) => {
        if (event.buttons) touch();
      },
      // A move up just after the reader's wheel, finger, key or drag is theirs: let go at once,
      // and take hold again only when they come back to the end. A move up with no input is the
      // text getting shorter as a block is redrawn, and changes nothing.
      onScroll: (event: UIEvent<HTMLDivElement>) => {
        const node = event.currentTarget;
        const theirs = performance.now() - touched.current < 400;
        if (theirs && node.scrollTop < top.current) follow.current = false;
        else if (node.scrollHeight - node.scrollTop - node.clientHeight < NEAR) follow.current = true;
        top.current = node.scrollTop;
      },
    },
  };
}
