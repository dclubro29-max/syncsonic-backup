import { performanceStrength, planPerformanceBase } from '@/lib/ultraPerformancePlan';

const seg = (to, over, after = 0) => ({ to, over, after });

/** Start the outgoing FX while its fader is still open, not after it is inaudible. */
export function schedulePartyMaxTransition(d, st, cfg, seconds, beat, delay = 0) {
  const k = performanceStrength(cfg), entry = planPerformanceBase(cfg), exit = planPerformanceBase(cfg);
  const total = Math.max(1, seconds), at = Math.max(0, delay);
  entry.beatSeconds = exit.beatSeconds = beat;
  entry.sweep = [seg(0.82 * k, 0.08), seg(0, total * 0.25, at + total * 0.12)];
  entry.echo = [seg(0, 0.04), seg(0.38 * k, 0.12, at + total * 0.3),
    seg(0, total * 0.22, at + total * 0.6)];
  entry.reverb = [seg(0, 0.04), seg(0.16 * k, total * 0.15, at + total * 0.3),
    seg(0, total * 0.22, at + total * 0.6)];
  exit.sweep = [seg(0, 0.04), seg(0.92 * k, total * 0.22, at + total * 0.08),
    seg(0, total * 0.12, at + total * 0.5)];
  exit.echo = [seg(0, 0.04), seg(0.65 * k, Math.min(beat, total * 0.08), at + total * 0.12),
    seg(0, total * 0.2, at + total * 0.6)];
  exit.reverb = [seg(0, 0.04), seg(0.24 * k, total * 0.12, at + total * 0.12),
    seg(0, total * 0.2, at + total * 0.6)];
  d.automateDeckPerformance(st.incomingDeck, entry);
  d.automateDeckPerformance(st.activeDeck, exit);
}