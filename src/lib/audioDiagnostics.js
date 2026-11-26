/**
 * Jurnal scurt al evenimentelor audio. Doar schimbări, nu eșantioane periodice,
 * ca diagnosticul să nu adauge el însuși trafic pe firul audio sau pe ecran.
 */
const MAX_EVENTS = 40;
const listeners = new Set();
let events = [];
let counts = {};
let sequence = 0;

const KINDS = {
  output: 'schimbare de ieșire',
  'output-failed': 'ieșire refuzată',
  recovery: 'reluare automată',
  underrun: 'pauză de randare',
  waiting: 'așteaptă date',
  stalled: 'flux blocat',
  error: 'eroare',
  context: 'motor audio',
  visibility: 'pagină',
  calibration: 'aliniere',
  beat: 'test cu beat',
  heard: 'confirmare fizică',
  unheard: 'confirmare retrasă',
};

export const DIAGNOSTIC_LABELS = KINDS;

function emit() {
  listeners.forEach((listener) => listener(events, counts));
}

export function pushAudioEvent(kind, message, detail = null) {
  const event = { id: ++sequence, at: Date.now(), kind, message, detail };
  events = [event, ...events].slice(0, MAX_EVENTS);
  counts = { ...counts, [kind]: (counts[kind] || 0) + 1 };
  emit();
}

export function subscribeAudioEvents(listener) {
  listeners.add(listener);
  listener(events, counts);
  return () => listeners.delete(listener);
}

export function resetAudioDiagnostics() {
  events = [];
  counts = {};
  emit();
}