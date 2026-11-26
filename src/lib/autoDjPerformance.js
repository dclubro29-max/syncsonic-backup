import { resetAutoPerformance } from '@/lib/autoPerformanceGraph';
import { reliableBeat } from '@/lib/autoDjTempo';
import { protectedMoment } from '@/lib/autoDjStructure';
import { planPerformanceBase } from '@/lib/ultraPerformancePlan';
import { planDropRitual, planEventAccent, planPhraseLift, planVocalAccent } from '@/lib/ultraChoreography';
import { schedulePartyMaxPerformance } from '@/lib/partyMaxPerformance';

export function resetPerformanceState(state) {
  if (!state) return;
  state.trackId = null;
  state.lastEvent = -Infinity;
  state.lastPhrase = null;
  state.until = 0;
  state.nextPartyAt = 0;
  state.signature = null;
  state.enabled = false;
}

/** Apply the audible base once; schedule only future, trusted musical moments. */
export function scheduleDeckPerformance({ stage, ctx, deck, audio, cfg, state }) {
  if (!stage || !ctx || !state || !audio) return null;
  const ready = cfg.performance && ctx.state === 'running' && !audio.paused &&
    !audio.seeking && audio.readyState >= 2 && !!deck?.track;
  if (!ready) {
    if (state.enabled) resetAutoPerformance(stage, ctx);
    resetPerformanceState(state);
    return null;
  }
  const signature = [deck.track.id, cfg.performanceMode, cfg.intensity,
    cfg.choreography !== false, !!cfg.partyMax, cfg.partyStyle].join('|');
  if (state.signature !== signature) {
    resetPerformanceState(state);
    state.trackId = deck.track.id;
    state.signature = signature;
    state.enabled = true;
    return cfg.partyMax ? schedulePartyMaxPerformance(ctx, deck, audio, cfg, state, true) : planPerformanceBase(cfg);
  }
  if (ctx.currentTime < state.until) return null;
  if (cfg.partyMax) return schedulePartyMaxPerformance(ctx, deck, audio, cfg, state);
  // Momentul din structură e o poziție absolută: merită folosit și când BPM-ul
  // e nesigur. Doar ritmul de fundal (frazele) cere un beat sigur.
  const trusted = reliableBeat(deck);
  if (!trusted && !deck.structure?.events?.length) return null;
  const source = audio.currentTime, rate = audio.playbackRate || 1;
  const beat = deck.bpm ? 60 / (deck.bpm * rate) : 0.5;
  // ULTRA își pregătește momentul din timp: build-ul începe cu câteva bătăi înainte.
  const horizon = Math.max(1.6, beat * 8);
  const event = deck.structure?.events?.find((item) => (item.confidence ?? 0) >= (trusted ? 0.72 : 0.84) &&
    item.at > state.lastEvent && item.at > source + rate * 0.7 &&
    item.at <= source + rate * horizon);
  if (event) {
    state.lastEvent = event.at;
    const after = (event.at - source) / rate;
    state.until = ctx.currentTime + after + beat * 9;
    const variant = Math.round(event.at / Math.max(0.01, beat)) % 4;
    // Cât din build mai e de la poziția de acum: filtrul și reverbul urcă exact
    // peste urcușul piesei, nu peste o fereastră fixă de două bătăi.
    // Ce fel de accent i se potrivește momentului, după scanare.
    const traits = { vocal: !!event.vocal, bright: !!event.bright, wide: !!event.wide,
      punch: !!event.punch, dynamic: deck.structure?.profile?.dynamic };
    const buildLead = Math.max(0, (event.at - Math.max(event.buildAt ?? event.at, source)) / rate);
    if (event.kind === 'drop' && cfg.choreography !== false) {
      return planDropRitual(cfg, beat, after, event.confidence ?? 0.8, buildLead, traits);
    }
    // Pe o parte cu voce, efectele lungi o acoperă: rămâne accentul scurt.
    if (event.vocal) return planVocalAccent(cfg, beat, after, traits);
    return planEventAccent(cfg, beat, after, event.kind, variant, traits);
  }
  if (!trusted) return null;
  const bar = 240 / deck.bpm, offset = deck.beatOffset || 0;
  const span = state.lastPhrase === null ? 1 : 16;
  const phrase = Math.ceil((source + rate * 0.08 - offset) / (bar * span)) * span;
  const at = offset + phrase * bar, after = (at - source) / rate;
  if (phrase === state.lastPhrase || after > horizon * 0.5 || at + bar * 2 > audio.duration ||
    protectedMoment(deck, at) || protectedMoment(deck, source)) return null;
  state.lastPhrase = phrase;
  state.until = ctx.currentTime + after + beat * 6;
  return planPhraseLift(cfg, beat, after, phrase / 16, { dynamic: deck.structure?.profile?.dynamic });
}