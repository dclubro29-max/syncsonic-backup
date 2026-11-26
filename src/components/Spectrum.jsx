import React, { useEffect, useRef } from "react";

/**
 * Vizualizator de spectru în timp real desenat pe canvas.
 * Primește `getSpectrum()` care întoarce datele de frecvență (0-255) sau null.
 */
export default function Spectrum({ getSpectrum, className = "h-24 w-full opacity-90" }) {
  const canvasRef = useRef(null);
  const smoothedRef = useRef(null);
  const colorsRef = useRef({ from: "#f59e0b", to: "#0f172a" });
  const frameRef = useRef(0);
  const gradRef = useRef({ key: "", grad: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    let running = true;
    let last = 0;

    const draw = (nowMs) => {
      if (!running) return;
      raf = requestAnimationFrame(draw);
      // 30 de cadre pe secundă: vizualizerul arată fluid, dar nu mai consumă
      // firul principal de care depinde livrarea sunetului către boxe.
      if (nowMs - last < 33) return;
      last = nowMs;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Reîmprospătează culorile din temă o dată pe secundă
      if (frameRef.current % 30 === 0) {
        const styles = window.getComputedStyle(document.documentElement);
        const to = styles.getPropertyValue("--primary").trim();
        const from = styles.getPropertyValue("--chart-4").trim();
        colorsRef.current = {
          to: to ? `hsl(${to})` : "#0f172a",
          from: from ? `hsl(${from})` : "#f59e0b",
        };
      }
      frameRef.current += 1;

      const data = getSpectrum ? getSpectrum() : null;
      const N = 56;
      if (!smoothedRef.current || smoothedRef.current.length !== N) {
        smoothedRef.current = new Array(N).fill(0);
      }
      const bars = smoothedRef.current.map((prev, i) => {
        let target = 0;
        if (data && data.length) {
          const idx = Math.min(
            data.length - 1,
            Math.floor(Math.pow(i / N, 1.7) * data.length * 0.72)
          );
          target = data[idx] / 255;
        }
        return Math.max(target, prev * 0.86);
      });
      smoothedRef.current = bars;

      const gap = 3;
      const bw = Math.max(1, (w - gap * (N - 1)) / N);
      // Gradientul se reface doar când se schimbă dimensiunea sau culorile.
      const gradKey = `${w}|${h}|${colorsRef.current.from}|${colorsRef.current.to}`;
      if (gradRef.current.key !== gradKey) {
        const grad = ctx.createLinearGradient(0, h, 0, 0);
        grad.addColorStop(0, colorsRef.current.from);
        grad.addColorStop(1, colorsRef.current.to);
        gradRef.current = { key: gradKey, grad };
      }
      ctx.fillStyle = gradRef.current.grad;
      for (let i = 0; i < N; i++) {
        const bh = Math.max(2, bars[i] * h);
        ctx.fillRect(i * (bw + gap), h - bh, bw, bh);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [getSpectrum]);

  return <canvas ref={canvasRef} className={className} />;
}