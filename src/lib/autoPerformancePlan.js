import { planMaxPeak } from '@/lib/maxPerformancePlan';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Cât de puternic reacționează fiecare moment detectat. */
const KIND_WEIGHT = { drop: 1, chorus: 0.7, peak: 0.45 };

/** Enhance detected energy without inventing a volume dip during the natural rise. */
export function planMusicalPeak(event, sourceTime, playbackRate, bpm, intensity = 0.75, mode = 'balanced') {
  const rate = playbackRate || 1;
  if (mode === 'max') return planMaxPeak(event, sourceTime, rate, bpm, intensity);
  const beat = 60 / (bpm * rate);
  const peak = Math.max(0.02, (event.at - sourceTime) / rate);
  const strength = clamp01(intensity) * (event.confidence ?? 0.7);
  const weight = KIND_WEIGHT[event.kind] ?? 0.5;
  const boost = (0.4 + 1.1 * strength) * weight;
  const lead = Math.max(0.02, peak - 0.04);
  const segment = (to, over, after) => ({ to, over, after });
  return {
    beatSeconds: beat,
    low: [segment(0, 0.02, 0), segment(boost, 0.04, peak), segment(0, beat * 4, peak + beat * 2)],
    // Small lift, with no automatic attenuation before it; master/volume lock are untouched.
    level: [segment(1, 0.02, 0), segment(1 + 0.035 * strength * weight, 0.04, peak),
      segment(1, beat * 4, peak + beat * 2)],
    sweep: [segment(0, 0.02, 0)],
    echo: [segment(0.16 * strength, lead, 0.02),
      segment((0.28 + 0.3 * weight) * strength, 0.06, peak),
      segment(0, beat * 3, peak + beat)],
  };
}

/** A short phrase-boundary echo; it never turns down the original song. */
export function planBarAccent(beatSeconds, intensity = 0.75, secondsToBoundary = beatSeconds * 2) {
  const strength = clamp01(intensity);
  const boundary = Math.max(0.04, secondsToBoundary);
  const segment = (to, over, after) => ({ to, over, after });
  return {
    beatSeconds,
    sweep: [segment(0, 0.02, 0)],
    echo: [segment(0.12 * strength, Math.max(0.02, boundary - 0.04), 0),
      segment(0.38 * strength, 0.04, boundary), segment(0, beatSeconds * 2, boundary + beatSeconds)],
    level: [segment(1, 0.02, 0)],
  };
}