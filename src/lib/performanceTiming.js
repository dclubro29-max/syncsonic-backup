import { planBarAccent } from '@/lib/autoPerformancePlan';
import { planMaxPhrase } from '@/lib/maxPerformancePlan';

function nextMaxAccent(deck, source, rate, intensity, previousBar, nextEvent, variant) {
  const beat = deck.bpm ? 60 / deck.bpm : 0.5;
  const offset = deck.beatOffset || 0;
  const position = Math.max(0, (source - offset) / (beat * 4));
  let bar = previousBar == null ? Math.floor(position) + 1 : Math.ceil((position + 0.15) / 4) * 4;
  let at = offset + bar * 4 * beat;
  if ((at - source) / rate < beat / rate + 0.05) {
    bar += previousBar == null ? 1 : 4;
    at = offset + bar * 4 * beat;
  }
  if (bar === previousBar || (at - source) / rate > Math.max(1.5, beat / rate * 4) || at + beat * 7 > deck.duration) return null;
  if (nextEvent && nextEvent.buildAt < at + beat * 7) return null;
  const plan = planMaxPhrase(beat / rate, intensity, (at - source) / rate, variant, !!deck.bpm);
  return { bar, at, plan, label: plan.label, releaseAt: source + plan.releaseAfter * rate };
}

/** Source seconds locate beats; playback speed only converts the scheduling delay. */
export function nextBarAccent(deck, source, rate, intensity, previousBar, nextEvent, mode = 'balanced', variant = 0) {
  if (mode === 'max') return nextMaxAccent(deck, source, rate, intensity, previousBar, nextEvent, variant);
  if (!deck.bpm) return null;
  const beat = 60 / deck.bpm;
  const position = (source - (deck.beatOffset || 0)) / beat;
  const bar = Math.floor(position / 4);
  if (bar < 0 || bar === previousBar || bar % 16 !== 15 || position - bar * 4 < 2) return null;
  const at = (deck.beatOffset || 0) + (bar + 1) * 4 * beat;
  if (at + 4 * beat > deck.duration || (nextEvent && nextEvent.buildAt < at + 4 * beat)) return null;
  const rows = deck.structure?.bars || [];
  const row = rows[Math.min(bar, rows.length - 1)];
  const previous = rows[Math.max(0, bar - 1)];
  // Never filter a natural rise or a loud peak merely because a timer expired.
  if (row && previous && row.energy > previous.energy + 0.7) return null;
  return { bar, at, plan: planBarAccent(beat / rate, intensity, Math.max(0.02, (at - source) / rate)) };
}