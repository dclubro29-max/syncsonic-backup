import { performanceBase, performanceStrength } from '@/lib/ultraPerformancePlan';

const seg = (to, over, after = 0) => ({ to, over, after });

/** Explicit Party MAX only: an audible opening, then space for the music. */
export function planPartyMaxPerformance(cfg, beat = 0.5, after = 0.06) {
  const k = performanceStrength(cfg), base = performanceBase(cfg);
  const start = Math.max(0.06, after), drop = start + beat * 4;
  const plan = {
    beatSeconds: beat,
    duration: start + beat * 10,
    label: 'Party MAX · build → drop',
    low: [seg(base.low, 0.04), seg(-9 * k, beat * 3, start),
      seg(Math.min(6, base.low + 2 * k), 0.1, drop), seg(base.low, beat * 2, drop + beat)],
    level: [seg(base.level, 0.04), seg(base.level * 0.9, beat * 3, start), seg(base.level, 0.1, drop)],
    sweep: [seg(0, 0.04), seg(0.94 * k, beat * 3, start), seg(0, 0.12, drop)],
    echo: [seg(0.28 * k, 0.12, start), seg(0.65 * k, beat * 2, start + beat),
      seg(0, beat * 3, drop + beat * 0.25)],
    reverb: [seg(0.24 * k, beat * 3, start), seg(0, beat * 3, drop)],
    color: [seg(0.35 * k, beat * 2, start), seg(0, beat * 3, drop)],
    pan: [seg(0, 0.04)],
  };
  if (cfg.partyStyle === 'stab') {
    plan.label = 'Party MAX · bass stabs + ecou';
    plan.low = [seg(base.low, 0.04)];
    for (let n = 0; n < 4; n++) {
      const at = start + n * beat * 2;
      plan.low.push(seg(-9 * k, 0.06, at), seg(base.low, beat * 0.5, at + beat * 0.4));
    }
    plan.sweep = [seg(0, 0.08)];
  }
  return plan;
}

/** No analysis gate: use detected tempo when available, otherwise a 120-BPM FX clock. */
export function schedulePartyMaxPerformance(ctx, deck, audio, cfg, state, first = false) {
  const rate = audio.playbackRate || 1;
  const bpm = Number(deck.bpm);
  const beat = Number.isFinite(bpm) && bpm > 0 ? 60 / (bpm * rate) : 0.5;
  const now = ctx.currentTime;
  if (!first && now + 0.4 < (state.nextPartyAt ?? 0)) return null;
  const after = first ? 0.06 : Math.max(0.06, (state.nextPartyAt ?? now) - now);
  const plan = planPartyMaxPerformance(cfg, beat, after);
  state.until = now + plan.duration;
  state.nextPartyAt = now + after + Math.max(plan.duration + beat * 4, beat * 32);
  return plan;
}