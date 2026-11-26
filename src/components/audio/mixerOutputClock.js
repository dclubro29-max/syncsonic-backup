/**
 * Ceasul motorului audio.
 *
 * `sinkId: { type: 'none' }` pare curat (nu deschide ieșirea implicită), dar în
 * Chromium acel sink este fals: randarea e împinsă de un cronometru, nu de un
 * ceas audio real, iar la încărcare (multe deck-uri, filtre, convoluții) apar
 * micro-goluri periodice în TOATE fluxurile derivate din context — exact
 * întreruperile care se aud identic pe fiecare boxă.
 *
 * Motorul rulează deci mereu pe ceasul hardware al ieșirii implicite a
 * sistemului. Fluxurile către boxele selectate pornesc din același context, iar
 * ieșirea implicită este ținută la volum 0 cât timp există boxe selectate,
 * ca sunetul să nu se audă de două ori.
 */
export function createMixerContext(Context) {
  return new Context({ latencyHint: 0.2 });
}

export function hasIndependentMixerClock() {
  return false;
}

/** Schimbarea ieșirii de referință nu mai este necesară: ceasul rămâne cel hardware. */
export async function routeMixerClock() {}