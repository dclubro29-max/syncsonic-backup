const VOLUME_KEY = 'musicsync.volume';
const LOCK_KEY = 'musicsync.volumeLock';

function readLevel(key) {
  const raw = localStorage.getItem(key);
  if (raw === null || raw.trim() === '') return null;
  const level = Number(raw);
  return Number.isFinite(level) && level >= 0 && level <= 1 ? level : null;
}

export function readMasterVolume() {
  try {
    const locked = readLevel(LOCK_KEY);
    return { level: locked ?? readLevel(VOLUME_KEY) ?? 1, locked };
  } catch {
    return { level: 1, locked: null };
  }
}

export function storeMasterVolume({ level, locked }) {
  try {
    localStorage.setItem(VOLUME_KEY, String(level));
    if (locked === null) localStorage.removeItem(LOCK_KEY);
    else localStorage.setItem(LOCK_KEY, String(locked));
  } catch {
    // The current session still keeps its synchronous volume guard.
  }
}