export const SKINS = [
  {
    id: 'studio',
    name: 'Studio',
    hint: 'Grafit și violet discret. Implicit, fără mișcare de fundal.',
    swatches: ['#0b0b12', '#1b1a26', '#8b5cf6', '#22d3ee'],
    ink: '#f5f3ff',
  },
  {
    id: 'daylight',
    name: 'Daylight',
    hint: 'Deschis, cu contrast bun pentru zi și ecrane luminoase.',
    swatches: ['#f7f5f2', '#ffffff', '#6d3fd8', '#0f766e'],
    ink: '#1c1b22',
  },
  {
    id: 'club',
    name: 'Club',
    hint: 'Albastru închis, cyan și violet. Fundal static, fără puls.',
    swatches: ['#07111f', '#0d1b2e', '#22d3ee', '#a855f7'],
    ink: '#e0f7ff',
  },
  {
    id: 'pulse',
    name: 'Pulse',
    hint: 'Fundal care respiră cu mixul master. Poate fi oprit sau redus.',
    swatches: ['#0a0714', '#171026', '#c084fc', '#22d3ee'],
    ink: '#f5eaff',
  },
];

export const PULSE_MODES = [
  { id: 'off', label: 'Oprit', hint: 'Fundal static.' },
  { id: 'reduced', label: 'Redus', hint: 'Pulsație discretă, fără unde.' },
  { id: 'normal', label: 'Normal', hint: 'Pulsație pe beat și undă scurtă la intrare puternică.' },
];

const SKIN_KEY = 'musicsync.skin';
const PULSE_KEY = 'musicsync.pulse';

export function readSkin() {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    return SKINS.some((skin) => skin.id === saved) ? saved : 'studio';
  } catch (e) {
    return 'studio';
  }
}

export function hasStoredSkin() {
  try {
    return !!localStorage.getItem(SKIN_KEY);
  } catch (e) {
    return false;
  }
}

export function storeSkin(id) {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch (e) {
    /* ignore */
  }
}

export function readPulseMode() {
  try {
    const saved = localStorage.getItem(PULSE_KEY);
    return PULSE_MODES.some((mode) => mode.id === saved) ? saved : 'normal';
  } catch (e) {
    return 'normal';
  }
}

export function storePulseMode(id) {
  try {
    localStorage.setItem(PULSE_KEY, id);
  } catch (e) {
    /* ignore */
  }
}