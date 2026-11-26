import { DEFAULT_BAND } from "@/lib/bands";

/** Starea inițială a unui deck. Fiecare deck pornește complet neutru. */
export const blankDeck = () => ({
  track: null,
  isPlaying: false,
  tempo: 1,
  eq: { low: 0, mid: 0, high: 0 },
  volume: 0.8,
  trim: 1,
  progress: 0,
  duration: 0,
  repeat: false,
  loop: null,
  fx: { echo: 0, reverb: 0, filter: 0, karaoke: 0 },
  cue: null,
  hotCues: [null, null, null, null],
  bpm: null,
  bpmDetected: null,
  bpmConfidence: 0,
  bpmManual: false,
  beatOffset: 0,
  beatOffsetDetected: 0,
  analyzing: false,
  analysisError: null,
  peaks: null,
  structure: null,
  // Câștig de nivelare calculat din piesa însăși; se înmulțește cu trim-ul manual.
  autoTrim: 1,
  loudness: null,
  // Preascultare în căști (PFL) și key lock (tempo fără schimbarea tonalității).
  monitor: false,
  keyLock: true,
});

const DELAY_KEY = (id) => `musicsync.delay.${id}`;

export const readStoredDelay = (id) => {
  try {
    const v = parseFloat(localStorage.getItem(DELAY_KEY(id)));
    return isFinite(v) ? Math.max(0, Math.min(500, v)) : 0;
  } catch (e) {
    return 0;
  }
};

export const storeDelay = (id, ms) => {
  try {
    localStorage.setItem(DELAY_KEY(id), String(ms));
  } catch (e) {
    /* ignore */
  }
};

const BAND_KEY = (id) => `musicsync.band.${id}`;

export const readStoredBand = (id) => {
  try {
    return localStorage.getItem(BAND_KEY(id)) || DEFAULT_BAND;
  } catch (e) {
    return DEFAULT_BAND;
  }
};

export const storeBand = (id, bandId) => {
  try {
    localStorage.setItem(BAND_KEY(id), bandId);
  } catch (e) {
    /* ignore */
  }
};

const CUE_KEY = "musicsync.cueOutput";

export const readStoredCueDevice = () => {
  try {
    return localStorage.getItem(CUE_KEY) || null;
  } catch (e) {
    return null;
  }
};

export const storeCueDevice = (deviceId) => {
  try {
    if (deviceId) localStorage.setItem(CUE_KEY, deviceId);
    else localStorage.removeItem(CUE_KEY);
  } catch (e) {
    /* ignore */
  }
};

/** Nivel și vârf dintr-un buffer de analiză, pentru vumetre. */
export const meterFrom = (buf) => {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sum / buf.length);
  const db = 20 * Math.log10(rms || 1e-6);
  return { level: Math.max(0, Math.min(1, (db + 60) / 60)), peak };
};