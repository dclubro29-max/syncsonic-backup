const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const reliableBeat = (deck) => !!deck?.bpm && !deck.analyzing && !deck.analysisError &&
  (deck.bpmManual || (deck.bpmConfidence ?? 0) >= 0.65);

/**
 * Bring nearby tempi together; never force a large time-stretch or guess a beat.
 *
 * Convenția DJ: piesa care cântă își păstrează tempo-ul natural — doar piesa
 * care intră se apropie de ea. Așa niciun element audio care se aude nu își
 * schimbă playbackRate-ul brusc (browserul poate scoate un mic salt auditibil
 * la fiecare rescriere), iar viteza se alege o singură dată, când deckul e mut.
 */
export function tempoBridge(outgoing, incoming, audio, config) {
  if (!config.beatmatch || !reliableBeat(outgoing) || !reliableBeat(incoming)) return null;
  const limit = config.tempoLimit ?? 0.08;
  const current = audio.playbackRate;
  const inRate = (outgoing.bpm * current) / incoming.bpm;
  if (inRate < 1 - limit || inRate > 1 + limit) return null;
  return { outRate: current, inRate };
}
export function canMatchTempo(outgoing, incoming, audio, config) {
  if (!config.beatmatch || !reliableBeat(outgoing) || !reliableBeat(incoming)) return false;
  const ratio = outgoing.bpm * audio.playbackRate / incoming.bpm;
  const limit = config.performanceMode === 'max' ? config.tempoLimit ?? 0.08 : 0.11;
  return ratio >= 1 - limit && ratio <= 1 + limit;
}
export function createTempoRamp(index, audio, deck, target, clock, bars = 8) {
  const beat = 60 / deck.bpm, bar = beat * 4;
  const phase = ((audio.currentTime - (deck.beatOffset || 0)) % bar + bar) % bar;
  const wait = phase < 0.025 ? 0 : (bar - phase) / audio.playbackRate;
  return { index, track: deck.track?.id, from: audio.playbackRate, target, elapsed: 0, last: clock,
    start: clock + wait, duration: bars * bar / audio.playbackRate };
}
/** Small real-time steps avoid a speed jump after background throttling or analysis. */
export function advanceTempoRamp(ramp, audio, clock, hold = false) {
  const previous = ramp.last;
  ramp.last = clock;
  if (hold || audio.paused || clock < ramp.start) return { rate: audio.playbackRate, done: false };
  ramp.elapsed += clamp(clock - Math.max(previous, ramp.start), 0, 0.5);
  const fraction = Math.min(1, ramp.elapsed / ramp.duration);
  const smooth = fraction * fraction * (3 - 2 * fraction);
  return { rate: ramp.from + (ramp.target - ramp.from) * smooth, done: fraction >= 1 };
}