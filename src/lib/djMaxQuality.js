/**
 * Precizia de mixaj a motoarelor DJ MAX / DJ MAX ULTRA: faza bătăilor și
 * corecția lentă de drift. Totul se calculează local, din timpii reali ai
 * deck-urilor; nimic nu modifică piesa care se aude.
 */

const wrap = (value) => ((value % 1) + 1) % 1;

/** Poziția în bătaie a unui deck, 0 = exact pe beat. */
export function deckPhase(deck, audio) {
  if (!deck?.bpm || !audio || !Number.isFinite(audio.currentTime)) return null;
  return wrap((audio.currentTime - (deck.beatOffset || 0)) / (60 / deck.bpm));
}

/**
 * Cât de departe sunt cele două deck-uri, în secunde. Pozitiv înseamnă că
 * deck-ul care intră o ia înaintea celui care cântă.
 */
export function beatDriftSeconds(deck, audio, referenceDeck, reference) {
  const incoming = deckPhase(deck, audio);
  const outgoing = deckPhase(referenceDeck, reference);
  if (incoming == null || outgoing == null) return null;
  let difference = incoming - outgoing;
  if (difference > 0.5) difference -= 1;
  if (difference < -0.5) difference += 1;
  return difference * (60 / deck.bpm);
}

/**
 * Tempo-ul corectat ca eroarea de fază să se închidă lin până la finalul
 * mixului. Corecțiile sunt minuscule (sub 0,5%) și se aplică doar deck-ului
 * care intră, deci piesa auzită nu își schimbă viteza.
 */
export function driftTempo(baseTempo, errorSeconds, remainingSeconds, options = {}) {
  const limit = options.limit ?? 0.005;
  const deadband = options.deadband ?? 0.008;
  if (!Number.isFinite(baseTempo) || !Number.isFinite(errorSeconds)) return baseTempo;
  if (Math.abs(errorSeconds) < deadband) return baseTempo;
  const span = Math.max(4, remainingSeconds || 0);
  const delta = Math.max(-limit, Math.min(limit, -errorSeconds / span));
  return baseTempo * (1 + delta);
}

const mean = (rows, key) => {
  const values = rows.map((row) => row[key]).filter((value) => Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
};

/** Energie și luminozitate medii din analiza locală, pentru potrivirea pieselor. */
export function deckStats(deck) {
  const bars = deck?.structure?.bars || [];
  if (!bars.length) return { energy: null, brightness: null, loudness: deck?.loudness ?? null, bpm: deck?.bpm ?? null };
  const energy = mean(bars, 'energy');
  const low = mean(bars, 'low');
  const mid = mean(bars, 'mid');
  return {
    energy,
    brightness: low != null && mid != null ? mid - low : null,
    loudness: deck?.loudness ?? null,
    bpm: deck?.bpm ?? null,
  };
}