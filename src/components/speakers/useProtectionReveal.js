import { useEffect, useRef, useState } from 'react';

export default function useProtectionReveal(value, ready) {
  const ref = useRef(null);
  const animated = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const [number, setNumber] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    if (!window.IntersectionObserver) { setRevealed(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setRevealed(true); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!ready || !revealed) return;
    if (animated.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setNumber(value);
      return;
    }
    animated.current = true;
    let frame, start;
    const tick = (time) => {
      start ??= time;
      const progress = Math.min((time - start) / 1400, 1);
      setNumber(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, ready, revealed]);
  return { ref, revealed, number };
}