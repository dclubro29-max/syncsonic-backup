import React, { useEffect, useRef } from "react";

/**
 * Contor de nivel real (RMS) cu vârf reținut și indicator de clipping.
 * `getMeter()` întoarce { level: 0..1, peak: 0..1 }.
 * Culorile vin din tokenii temei, ca indicatorul să apară la fel în tot studio-ul.
 */
export default function LevelMeter({ getMeter, className = "" }) {
  const barRef = useRef(null);
  const peakRef = useRef(null);
  const clipRef = useRef(null);
  const getterRef = useRef(getMeter);
  const peakHold = useRef(0);
  const peakAt = useRef(0);
  const clipAt = useRef(0);

  getterRef.current = getMeter;

  useEffect(() => {
    let raf;
    let running = true;
    let last = 0;
    const tick = (nowMs) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      // 20 de cadre pe secundă sunt suficiente pentru un contor și lasă
      // firul principal liber pentru fluxurile audio ale boxelor.
      if (nowMs - last < 50) return;
      last = nowMs;
      const m = getterRef.current ? getterRef.current() : null;
      const level = m ? m.level : 0;
      const peak = m ? m.peak : 0;
      const now = performance.now();

      if (level >= peakHold.current) {
        peakHold.current = level;
        peakAt.current = now;
      } else if (now - peakAt.current > 1200) {
        peakHold.current = Math.max(level, peakHold.current - 0.012);
      }

      if (peak >= 0.99) clipAt.current = now;
      const clipping = now - clipAt.current < 900;

      if (barRef.current) {
        barRef.current.style.width = `${Math.min(100, level * 100)}%`;
        barRef.current.style.backgroundColor = clipping
          ? "hsl(var(--destructive))"
          : level > 0.88
            ? "hsl(var(--warning))"
            : "hsl(var(--success))";
      }
      if (peakRef.current) {
        peakRef.current.style.left = `${Math.min(99.5, peakHold.current * 100)}%`;
      }
      if (clipRef.current) {
        clipRef.current.style.opacity = clipping ? "1" : "0";
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full border border-border/50 bg-surface-inset">
        <div
          ref={barRef}
          className="h-full rounded-full transition-none"
          style={{ width: "0%" }}
          aria-hidden="true"
        />
        <div
          ref={peakRef}
          className="absolute top-0 h-full w-px bg-foreground/70"
          style={{ left: "0%" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, transparent 0, transparent 5px, hsl(var(--background)) 5px, hsl(var(--background)) 6px)",
          }}
          aria-hidden="true"
        />
      </div>
      <span
        ref={clipRef}
        className="rounded px-1 font-mono text-[9px] font-bold tracking-wider text-destructive-foreground opacity-0"
        style={{ backgroundColor: "hsl(var(--destructive))" }}
      >
        CLIP
      </span>
    </div>
  );
}