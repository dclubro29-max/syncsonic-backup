import { musicalExit, mixZone, entryCue } from '@/lib/autoDjStructure';
import { canMatchTempo } from '@/lib/autoDjTempo';

export const MIX_STYLE_NAMES = { smooth: 'Mix pe frază', cut: 'Trecere scurtă', filter: 'Mix cu filtru' };

/** Full-length playback by default; an early phrase exit requires an explicit mixBars setting. */
export function mixExitPosition(deck, audio, config) {
  const duration = audio?.duration;
  if (!Number.isFinite(duration) || config.performanceMode !== 'max' || !deck?.bpm || !config.mixBars) return duration;
  return musicalExit(deck, duration, config.mixBars);
}

/** Nu tăiem niciodată prima parte a piesei, doar de la jumătate încolo. */
export const MIX_POINT_MIN_PLAY = 0.45;

/**
 * Punctul de ieșire al piesei care cântă, ales din muzică și nu din calendar:
 * se caută următoarea margine de frază (8 măsuri) cu energie sub medie, care nu
 * urcă și nu e vârf protejat. Poate fi oriunde în piesă, nu doar la final — dacă
 * nu există o astfel de zonă, se merge până la finalul natural.
 */
export function smartExitPosition(deck, audio, config) {
  const duration = audio?.duration;
  if (!Number.isFinite(duration) || duration <= 0) return Infinity;
  if (config?.mixPoints !== 'smart' || !deck?.bpm) return mixExitPosition(deck, audio, config);
  const bar = 240 / deck.bpm;
  const offset = deck.beatOffset || 0;
  const played = audio.currentTime || 0;
  // Căutăm doar de aici înainte, ca tranziția să aibă timp să se încheie pe frază.
  const nowBar = Math.ceil((Math.max(played, duration * MIX_POINT_MIN_PLAY) - offset) / bar);
  const point = musicalExit(deck, duration, nowBar + 8);
  const lead = (config.crossfade || 8) * (audio.playbackRate || 1);
  return Math.min(duration, Math.max(played + lead, point));
}

export function chooseMixStyle(config, outgoing, incoming, aligned) {
  if (config.transition !== 'adaptive') {
    if (config.transition === 'cut') return 'cut';
    if (config.transition === 'filter') return 'filter';
    return 'smooth';
  }
  if (!aligned) return 'smooth';
  // Pe zone dense o suprapunere lungă începe să „miorlăie”: trecem scurt, pe beat.
  const at = outgoing.progress || 0, cue = entryCue(incoming);
  const out = mixZone(outgoing, at, at + 240 / outgoing.bpm);
  const next = mixZone(incoming, cue, cue + 480 / incoming.bpm);
  return out && next && out.density > 0.5 && next.density > 0.5 ? 'cut' : 'smooth';
}

/**
 * Lungimea crossfade-ului, în măsuri întregi.
 *
 * Tranziția se încheie pe un început de frază (vezi exitRemaining din useAutoDj),
 * iar aici lungimea se rotunjește la măsuri ca să pornească tot pe un început de
 * frază: 8 măsuri (o frază) pentru piese aerisite, 4 măsuri când ambele zone sunt
 * dense. Așa ambele piese cad pe aceeași structură muzicală, nu la jumătatea ei.
 */
export function mixDuration(config, style, beat, available, incomingTime, aligned, outgoing, incoming) {
  const bar = beat * 4;
  const cap = Math.max(0, Math.min(available - 0.1, incomingTime / 2));
  const room = Math.floor(cap / bar) * bar;
  if (config.performanceMode !== 'max') {
    const short = style === 'cut' ? 0.6 : config.crossfade;
    return Math.max(0.05, Math.min(short, cap));
  }
  if (!aligned) return Math.max(0.05, Math.min(config.crossfade, 8, cap));
  if (style === 'cut') return Math.max(0.05, Math.min(beat, cap));
  if (style === 'filter') {
    // Filtrul are nevoie de timp să respire: 4–8 măsuri, pe început de frază.
    const wanted = Math.min(bar * 8, Math.max(bar * 4, Math.round(config.crossfade / bar) * bar));
    return Math.max(0.05, Math.min(wanted, cap));
  }
  const cue = entryCue(incoming);
  const intro = incoming?.bpm ? mixZone(incoming, cue, cue + 480 / incoming.bpm) : null;
  const out = outgoing?.bpm ? mixZone(outgoing, outgoing.progress || 0, (outgoing.progress || 0) + 480 / outgoing.bpm) : null;
  const dense = !intro || !out || intro.density > 0.5 || out.density > 0.5;
  const requested = Math.max(bar, Math.round(config.crossfade / bar) * bar);
  const wanted = Math.min(requested, dense ? bar * 4 : bar * 8);
  if (room >= bar) return Math.min(wanted, room);
  return Math.max(0.05, Math.min(cap, wanted));
}

export function previewMixDuration(config, outgoing, incoming, a, b) {
  const aligned = canMatchTempo(outgoing, incoming, a, config);
  const style = chooseMixStyle(config, outgoing, incoming, aligned);
  const beat = outgoing?.bpm ? 60 / (outgoing.bpm * a.playbackRate) : 0.5;
  // Plan the window without shrinking it on every tick; actual startMix bounds it to the remaining tail.
  return mixDuration(config, style, beat, Infinity,
    (b.duration - entryCue(incoming)) / b.playbackRate, aligned, outgoing, incoming);
}