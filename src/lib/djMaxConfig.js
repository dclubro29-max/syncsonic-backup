export const DJ_MAX_CONFIG = {
  musicalVersion: 5,
  qualityVersion: 3,
  performanceMode: 'max',
  partyMax: false,
  partyStyle: 'build',
  performance: false,
  intensity: 0.6,
  transition: 'adaptive',
  crossfade: 16,
  beatmatch: true,
  bassSwap: true,
  mixBars: 0,
  tempoLimit: 0.08,
  // Mixaj pe punct ales din muzică, care poate fi și la mijlocul piesei.
  mixPoints: 'smart',
  transitionFx: false,
  // Precizia MAX: faza bătăilor ținută pe tot blendul, EQ de crossover și
  // selecție după tempo, nivel, timbru și curba de energie a setului.
  driftLock: true,
  eqCrossover: true,
  smartSelect: true,
  choreography: false,
  // După fiecare tranziție, tempo-ul revine lin la viteza naturală a piesei,
  // ca setul să nu alunece tot mai sus piesă după piesă.
  tempoConverge: true,
};

/**
 * DJ MAX ULTRA — tot ce e mai bun din motor, reglat pentru show:
 * precizia MAX plus o coregrafie construită pe momentele reale ale piesei
 * (build → drop), cu revenire curată la nivelul de bază după fiecare accent.
 * mixBars 0 păstrează durata muzicală, fără scurtare la un timer arbitrar.
 */
export const DJ_ULTRA_CONFIG = {
  ...DJ_MAX_CONFIG,
  performance: true,
  transitionFx: true,
  intensity: 0.95,
  crossfade: 20,
  tempoLimit: 0.07,
  choreography: true,
};

/** Explicit maximum party effects; other DJ presets keep their original sound. */
export const PARTY_MAX_CONFIG = {
  ...DJ_ULTRA_CONFIG,
  partyMax: true,
  partyStyle: 'build',
  intensity: 1,
  transition: 'smooth',
  crossfade: 12,
};

/**
 * Party MAX Ultra din Redare: același motor ULTRA, dar fără ieșire prematură.
 * „Mix din mijlocul piesei" rămâne opțional în Mixer; aici piesa curge până
 * aproape de final, ca refrenul, build-ul și drop-ul să nu fie tăiate.
 */
export const PARTY_MAX_ULTRA_CONFIG = {
  ...PARTY_MAX_CONFIG,
  crossfade: 20,
  intensity: 0.95,
  mixPoints: 'end',
};