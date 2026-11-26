/** Beatgrid positions are in source seconds, independent of playback speed. */
export function alignAudioBeats(audio, reference, deck, referenceDeck, { silent = false } = {}) {
  if (!deck?.bpm || !referenceDeck?.bpm) return null;
  const tempo = Math.max(0.5, Math.min(2, referenceDeck.bpm * reference.playbackRate / deck.bpm));
  const beat = 60 / deck.bpm;
  const referenceBeat = 60 / referenceDeck.bpm;
  // Pe un deck încă mut aliniem MĂSURA, nu doar bătaia: intrarea pornește pe
  // primul timp al măsurii, deci ambele piese cad pe același „unu-doi-trei-patru”.
  // Pe un deck care se aude rămâne corecția fină de o bătaie, ca să nu sară muzica.
  const period = audio.paused || silent ? beat * 4 : beat;
  const referencePeriod = audio.paused || silent ? referenceBeat * 4 : referenceBeat;
  const phase = (time, offset, p) => ((time - offset) / p % 1 + 1) % 1;
  let difference = phase(reference.currentTime, referenceDeck.beatOffset || 0, referencePeriod)
    - phase(audio.currentTime, deck.beatOffset || 0, period);
  if (difference > 0.5) difference -= 1;
  if (difference < -0.5) difference += 1;
  const limit = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - 0.01) : Infinity;
  let position = audio.currentTime + difference * period;
  if (position < 0) position += period;
  const progress = Math.min(limit, Math.max(0, position));
  if (Math.abs(audio.playbackRate - tempo) > 0.000001) audio.playbackRate = tempo;
  audio.currentTime = progress;
  return { tempo, progress };
}

/**
 * Corecție fină de fază în timpul tranziției: dacă piesa care intră rămâne în
 * urmă sau o ia înainte față de cea care cântă, tempo-ul ei se ajustează cu cel
 * mult câteva procente, ca beat-urile să cadă unul peste altul până la finalul
 * crossfade-ului. Key lock-ul rămâne activ, deci corecția nu se aude ca pitch.
 */
export function lockAudioBeatPhase(audio, deck, reference, referenceDeck, baseTempo, maxCorrection = 0.006) {
  if (!audio || !reference || !deck?.bpm || !referenceDeck?.bpm) return baseTempo;
  const beat = 60 / deck.bpm;
  const referenceBeat = 60 / referenceDeck.bpm;
  const phase = (time, offset, period) => ((time - offset) / period % 1 + 1) % 1;
  let difference = phase(reference.currentTime, referenceDeck.beatOffset || 0, referenceBeat)
    - phase(audio.currentTime, deck.beatOffset || 0, beat);
  if (difference > 0.5) difference -= 1;
  if (difference < -0.5) difference += 1;
  const correction = Math.max(-maxCorrection, Math.min(maxCorrection, difference * 0.08));
  const tempo = Math.max(0.5, Math.min(2, baseTempo * (1 + correction)));
  // Corecțiile se cuantizează: fără rescrieri de playbackRate de patru ori pe secundă.
  if (Math.abs(audio.playbackRate - tempo) > 0.0025) audio.playbackRate = tempo;
  return tempo;
}

/** Hold the audible value, including curves that already started. */
export function holdAudioParameter(parameter, time) {
  if (!parameter) return;
  if (typeof parameter.cancelAndHoldAtTime === "function") parameter.cancelAndHoldAtTime(time);
  else {
    const value = parameter.value;
    parameter.cancelScheduledValues(0);
    parameter.setValueAtTime(value, time);
  }
}

/** Equal-power curves avoid the volume dip of two linear gain ramps. */
export function scheduleCrossfade(context, left, right, target, seconds, delay = 0) {
  if (!context || !left || !right) return;
  const now = context.currentTime, time = now + Math.max(0, delay);
  const duration = Math.max(0.05, seconds);
  const startLeft = left.value;
  const startRight = right.value;
  const startAngle = Math.atan2(startRight, startLeft);
  const startLevel = Math.hypot(startLeft, startRight);
  const endAngle = target * Math.PI / 2;
  const curves = [new Float32Array(128), new Float32Array(128)];
  for (let i = 0; i < 128; i++) {
    const fraction = i / 127;
    const angle = startAngle + (endAngle - startAngle) * fraction;
    const level = startLevel + (1 - startLevel) * fraction;
    curves[0][i] = Math.cos(angle) * level;
    curves[1][i] = Math.sin(angle) * level;
  }
  [left, right].forEach((parameter, i) => {
    holdAudioParameter(parameter, now);
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(curves[i][0], now);
    parameter.setValueCurveAtTime(curves[i], time, duration);
  });
}