/**
 * Profiluri de aliniere salvate local, pe configurație de boxe și pe zonă.
 * Configurația este identificată de setul de ieșiri, deci un profil nu se
 * aplică niciodată peste alt grup de boxe fără să fie marcat ca atare.
 */
const KEY = 'musicsync.alignmentProfiles';
const MAX_PROFILES = 12;

const read = () => {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
};

const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_PROFILES)));
  } catch (e) {
    /* storage unavailable */
  }
};

export const configKey = (deviceIds) => [...deviceIds].sort().join('|');

export function readProfiles() {
  return read();
}

export function saveProfile({ zone, deviceIds, delays, before, after, verified, uncertainty }) {
  const key = configKey(deviceIds);
  const name = (zone || 'Zona principală').trim().slice(0, 40) || 'Zona principală';
  const profile = {
    id: `${key}::${name}`,
    configKey: key,
    zone: name,
    deviceIds: [...deviceIds],
    delays: delays.map(({ deviceId, delay }) => ({ deviceId, delay: Math.round(delay) })),
    before: Math.round(before * 10) / 10,
    after: Math.round(after * 10) / 10,
    uncertainty: Math.round(uncertainty * 10) / 10,
    verified: !!verified,
    savedAt: Date.now(),
  };
  const next = [profile, ...read().filter((item) => item.id !== profile.id)];
  write(next);
  return { profile, profiles: next.slice(0, MAX_PROFILES) };
}

export function deleteProfile(id) {
  const next = read().filter((item) => item.id !== id);
  write(next);
  return next;
}

export function profilesFor(deviceIds) {
  const key = configKey(deviceIds);
  return read().map((profile) => ({ ...profile, matches: profile.configKey === key }));
}