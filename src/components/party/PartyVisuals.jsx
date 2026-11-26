import React, { useEffect, useRef } from "react";

/**
 * Vizualizări care reacționează la sunetul real (datele analizorului master).
 * Trei variante: spectru, undă și fundal animat. Cu animații reduse cadrele sunt
 * rare și trecerile mult mai line, ca să nu apară pâlpâieli rapide.
 */
export default function PartyVisuals({
  getSpectrum,
  mode = "spectrum",
  reduced = false,
  className = "",
}) {
  const ref = useRef(null);
  const smoothRef = useRef(null);
  const energyRef = useRef(0);
  const colorsRef = useRef({ a: "hsl(187 92% 56%)", b: "hsl(320 84% 66%)" });
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const N = 72;
    let raf;
    let alive = true;

    const draw = () => {
      if (!alive) return;
      raf = requestAnimationFrame(draw);
      frameRef.current += 1;
      if (reduced && frameRef.current % 4 !== 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Culorile se citesc din temă o dată la ~1,5s, nu la fiecare cadru.
      if (frameRef.current % 90 === 0) {
        const styles = window.getComputedStyle(document.documentElement);
        const a = styles.getPropertyValue("--deck-a").trim();
        const b = styles.getPropertyValue("--deck-b").trim();
        colorsRef.current = {
          a: a ? `hsl(${a})` : "#22d3ee",
          b: b ? `hsl(${b})` : "#e879c8",
        };
      }

      const data = getSpectrum ? getSpectrum() : null;
      if (!smoothRef.current || smoothRef.current.length !== N) {
        smoothRef.current = new Array(N).fill(0);
      }
      const decay = reduced ? 0.94 : 0.82;
      const bars = smoothRef.current.map((prev, i) => {
        let target = 0;
        if (data && data.length) {
          const idx = Math.min(
            data.length - 1,
            Math.floor(Math.pow(i / N, 1.8) * data.length * 0.7)
          );
          target = data[idx] / 255;
        }
        return Math.max(target, prev * decay);
      });
      smoothRef.current = bars;

      const bass = bars.slice(0, 8).reduce((sum, v) => sum + v, 0) / 8;
      energyRef.current += (bass - energyRef.current) * (reduced ? 0.05 : 0.14);
      const energy = energyRef.current;

      ctx.clearRect(0, 0, w, h);
      const { a, b } = colorsRef.current;

      if (mode === "ambient") {
        const blobs = [
          { x: w * 0.28, y: h * 0.62, r: 0.34, color: a, alpha: 0.28 + energy * 0.3 },
          { x: w * 0.74, y: h * 0.34, r: 0.3, color: b, alpha: 0.22 + energy * 0.28 },
        ];
        blobs.forEach((blob) => {
          const radius = Math.max(w, h) * (blob.r + energy * 0.07);
          const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, radius);
          grad.addColorStop(0, withAlpha(blob.color, Math.min(0.55, blob.alpha)));
          grad.addColorStop(1, withAlpha(blob.color, 0));
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        });
        return;
      }

      if (mode === "wave") {
        const mid = h * 0.55;
        const amp = Math.min(h * 0.34, h * 0.16 + energy * h * 0.2);
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * w;
          const y = mid - bars[i] * amp;
          if (i === 0) ctx.moveTo(x, y);
          else {
            const px = ((i - 1) / (N - 1)) * w;
            ctx.quadraticCurveTo((px + x) / 2, mid - bars[i - 1] * amp, x, y);
          }
        }
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, a);
        grad.addColorStop(1, b);
        ctx.strokeStyle = grad;
        ctx.lineWidth = reduced ? 2 : 3;
        ctx.lineJoin = "round";
        if (!reduced) {
          ctx.shadowColor = withAlpha(a, 0.5);
          ctx.shadowBlur = 24;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.lineTo(w, mid + h * 0.2);
        ctx.lineTo(0, mid + h * 0.2);
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, mid - amp, 0, mid + h * 0.2);
        fill.addColorStop(0, withAlpha(a, 0.28));
        fill.addColorStop(1, withAlpha(b, 0));
        ctx.fillStyle = fill;
        ctx.fill();
        return;
      }

      // Spectru: bare oglindite față de linia de mijloc.
      const gap = 3;
      const bw = Math.max(1, (w - gap * (N - 1)) / N);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, a);
      grad.addColorStop(0.55, b);
      grad.addColorStop(1, a);
      ctx.fillStyle = grad;
      for (let i = 0; i < N; i++) {
        const bh = Math.max(2, bars[i] * h * 0.44);
        const x = i * (bw + gap);
        ctx.fillRect(x, h / 2 - bh, bw, bh);
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x, h / 2, bw, bh * 0.7);
        ctx.globalAlpha = 1;
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [getSpectrum, mode, reduced]);

  return <canvas ref={ref} className={className} />;
}

/** Aceeași culoare, cu transparență — culorile vin ca „hsl(h s% l%)". */
function withAlpha(color, alpha) {
  if (color.startsWith("hsl(")) {
    return color.replace("hsl(", "hsla(").replace(")", ` / ${alpha})`);
  }
  return color;
}