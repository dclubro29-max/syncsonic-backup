import { getTrackProfiles, saveTrackProfile } from '@/lib/trackStore';

/**
 * Profilul muzical al fiecărei piese (BPM, încredere, nivel mediu), păstrat
 * local. Auto DJ îl folosește ca să aleagă următoarea piesă care se leagă cu
 * cea care cântă, nu doar în ordinea din bibliotecă.
 */
let cache = null;
let loading = null;

export async function loadTrackProfiles() {
  if (cache) return cache;
  if (!loading) {
    loading = getTrackProfiles()
      .then((list) => {
        cache = new Map(list.map((profile) => [profile.id, profile]));
        return cache;
      })
      .catch(() => {
        cache = new Map();
        return cache;
      })
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

export function getTrackProfile(id) {
  return (cache && cache.get(id)) || null;
}

export function rememberTrackProfile(id, profile) {
  if (!id || !profile) return;
  if (!cache) cache = new Map();
  const next = { ...(cache.get(id) || {}), ...profile };
  cache.set(id, next);
  saveTrackProfile(id, next).catch(() => {});
}