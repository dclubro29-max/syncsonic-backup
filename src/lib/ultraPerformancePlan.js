const seg = (to, over, after = 0) => ({ to, over, after });
export const performanceStrength = (cfg) => Math.max(0.2, Math.min(1, Number(cfg.intensity) || 0.6));

/** Audible tone and headroom, independent of BPM analysis. Never changes master volume. */
export function performanceBase(cfg) {
  const k = performanceStrength(cfg);
  const max = cfg.performanceMode === 'max';
  return { low: max ? 3.8 * k : 0, level: max ? Math.pow(10, -2 * k / 20) : 1 };
}

export function planPerformanceBase(cfg) {
  const base = performanceBase(cfg);
  return { low: [seg(base.low, 0.3)], level: [seg(base.level, 0.3)],
    sweep: [seg(0, 0.15)], echo: [seg(0, 0.15)], reverb: [seg(0, 0.15)], pan: [seg(0, 0.15)] };
}

/** One musical accent, not a beat-by-beat pump; always returns to the same baseline. */
export function planUltraAccent(cfg, beat, after, drop = false, variant = 0) {
  const k = performanceStrength(cfg), base = performanceBase(cfg);
  const at = Math.max(0.08, after), tail = at + beat * 2;
  return { beatSeconds: beat,
    low: [seg(base.low, 0.04), seg(base.low + (drop ? 1.8 : 0.8) * k, 0.08, at), seg(base.low, beat * 3, tail)],
    level: [seg(base.level, 0.04), seg(base.level * (1 + 0.1 * k), 0.12, at), seg(base.level, beat * 3, tail)],
    echo: [seg(0, 0.04), seg((variant % 2 ? 0.22 : 0.4) * k, 0.08, at), seg(0, beat * 3, tail)],
    reverb: [seg(0, 0.04), seg((variant % 2 ? 0.24 : 0.12) * k, 0.08, at), seg(0, beat * 4, tail)],
  };
}