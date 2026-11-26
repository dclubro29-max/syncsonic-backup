import React, { useRef, useEffect } from "react";

/** Culorile marcajelor de structură (refren/drop), folosite și în legendă. */
export const STRUCTURE_COLORS = {
  drop: "hsl(320 80% 62%)",
  chorus: "hsl(160 70% 45%)",
  peak: "hsl(265 70% 65%)",
};

const W = 1000;
const H = 64;
const DIM = "rgba(148,163,184,0.30)";

const makeLayer = () => {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return canvas;
};

const drawBars = (g, peaks, color) => {
  g.fillStyle = color;
  const n = peaks.length;
  const bw = W / n;
  for (let i = 0; i < n; i++) {
    const h = Math.max(1.5, peaks[i] * H * 0.9);
    g.fillRect(i * bw, (H - h) / 2, Math.max(1, bw * 0.75), h);
  }
};

/**
 * Formă de undă reală, desenată din vârfurile calculate pe eșantioane.
 *
 * Straturile care nu se schimbă (vârfuri, beatgrid, structura piesei, CUE,
 * loop) se desenează o singură dată, în două imagini: una stinsă și una aprinsă.
 * La fiecare avans al redării se copiază acele imagini și se decupează partea
 * ascultată — două operații, nu două mii. Altfel desenarea concura redarea
 * audio pe firul principal, iar fluxurile boxelor se opreau periodic.
 */
export default function Waveform({ peaks, progress, duration, cue, hotCues = [], loop, structure = [], color, analyzing, error, onSeek, bpm, tempo = 1, beatOffset = 0 }) {
  const ref = useRef(null);
  const layersRef = useRef({ key: null, base: null, lit: null });

  const hotKey = hotCues.join(",");
  const structureCount = structure.length;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");

    const key = [
      peaks ? peaks.length : 0,
      duration,
      bpm,
      tempo,
      beatOffset,
      color,
      analyzing ? 1 : 0,
      error || "",
      cue == null ? "" : cue,
      structureCount,
      loop ? `${loop.start}-${loop.end}` : "",
      hotKey,
    ].join("|");

    if (layersRef.current.key !== key) {
      // Culorile temei se citesc o singură dată per variantă, nu la fiecare cadru.
      const theme = window.getComputedStyle(c);
      const tokenMatch = typeof color === "string" ? color.match(/^hsl\(var\((--[\w-]+)\)\)$/) : null;
      const rawToken = tokenMatch ? theme.getPropertyValue(tokenMatch[1]).trim() : "";
      const waveColor = rawToken ? `hsl(${rawToken})` : color;

      const base = makeLayer();
      const bg = base.getContext("2d");
      bg.fillStyle = "rgba(148,163,184,0.10)";
      bg.fillRect(0, 0, W, H);

      if (!peaks) {
        bg.fillStyle = "rgba(148,163,184,0.85)";
        bg.font = "12px ui-sans-serif, system-ui, sans-serif";
        bg.fillText(error ? "Analiza a eșuat" : analyzing ? "Analizez piesa…" : "Fără analiză", 10, H / 2 + 4);
        layersRef.current = { key, base, lit: null };
      } else {
        drawBars(bg, peaks, DIM);

        // Beatgrid: o linie la fiecare bătaie; downbeat-urile (fiecare a 4-a) mai accentuate.
        if (bpm && duration > 0) {
          const beatLen = 60 / (bpm * (tempo || 1));
          if (beatLen > 0.05) {
            const off = beatOffset || 0;
            const first = off - Math.floor(off / beatLen) * beatLen;
            const barIndex = Math.round((first - off) / beatLen);
            const fg = theme.color;
            let k = 0;
            for (let t = first; t <= duration; t += beatLen) {
              const x = (t / duration) * W;
              const isBar = (barIndex + k) % 4 === 0;
              bg.globalAlpha = isBar ? 0.55 : 0.22;
              bg.fillStyle = fg;
              bg.fillRect(x, 0, isBar ? 1.5 : 1, H);
              k++;
            }
            bg.globalAlpha = 1;
          }
        }

        // Momentele estimate: zona de pregătire umbrită, linie la intrarea în vârf.
        if (structure.length && duration > 0) {
          structure.forEach((event) => {
            const fill = STRUCTURE_COLORS[event.kind] || STRUCTURE_COLORS.peak;
            const xa = Math.max(0, (event.buildAt / duration) * W);
            const xb = Math.min(W, (event.at / duration) * W);
            if (xb > xa) {
              bg.globalAlpha = 0.16;
              bg.fillStyle = fill;
              bg.fillRect(xa, 0, xb - xa, H);
            }
            bg.globalAlpha = 1;
            bg.fillStyle = fill;
            bg.fillRect(Math.max(0, Math.min(W - 2, xb)), 0, 2, H);
          });
        }

        const mark = (t, fill) => {
          if (t == null || !duration) return;
          const x = Math.max(0, Math.min(W - 2, (t / duration) * W));
          bg.fillStyle = fill;
          bg.fillRect(x, 0, 2, H);
        };

        if (loop && duration) {
          const x1 = Math.max(0, (loop.start / duration) * W);
          const x2 = Math.min(W, (loop.end / duration) * W);
          bg.fillStyle = "rgba(56,189,248,0.18)";
          bg.fillRect(x1, 0, Math.max(2, x2 - x1), H);
          mark(loop.start, "hsl(199 89% 60%)");
          mark(loop.end, "hsl(199 89% 60%)");
        }

        hotCues.forEach((t) => mark(t, "hsl(48 96% 55%)"));
        mark(cue, "hsl(0 84% 62%)");

        const lit = makeLayer();
        drawBars(lit.getContext("2d"), peaks, waveColor);
        layersRef.current = { key, base, lit };
      }
    }

    const { base, lit } = layersRef.current;
    g.clearRect(0, 0, W, H);
    if (base) g.drawImage(base, 0, 0);
    if (lit && duration > 0 && progress > 0) {
      const playedW = Math.min(1, progress / duration) * W;
      g.save();
      g.beginPath();
      g.rect(0, 0, playedW, H);
      g.clip();
      g.drawImage(lit, 0, 0);
      g.restore();
    }
  }, [peaks, progress, duration, cue, hotCues, loop, structure, color, analyzing, error, bpm, tempo, beatOffset, hotKey, structureCount]);

  const handleClick = (e) => {
    if (!duration || !onSeek) return;
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    onSeek(Math.max(0, Math.min(duration, frac * duration)));
  };

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      onClick={handleClick}
      title="Click pentru a sări în piesă"
      className="h-16 w-full cursor-pointer rounded-lg"
    />
  );
}