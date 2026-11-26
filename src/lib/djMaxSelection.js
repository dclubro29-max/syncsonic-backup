import { getTrackProfile } from '@/lib/trackProfile';
import { deckStats } from '@/lib/djMaxQuality';

/**
 * Selecția pieselor pentru DJ MAX / MAX ULTRA: tempo cât mai apropiat (fără
 * salturi de octavă), nivel sonor și timbru apropiate, plus o curbă de energie
 * care urcă încet. Toate valorile vin din analiza locală a pieselor.
 */

export const TEMPO_LIMIT = 0.1;

const clamp01 = (value) => Math.max(0, Math.min(1, value));

/**
 * Cât de bine se potrivește tempo-ul pentru beatmatch. Se folosește raportul
 * real, la fel ca motorul: o piesă de 90 BPM nu intră peste una de 120 doar
 * pentru că seamănă la dublu, fiindcă nu s-ar putea alinia bătăile.
 */
export function tempoFit(candidateBpm, currentBpm) {
  if (!candidateBpm || !currentBpm) return null;
  const ratio = candidateBpm / currentBpm;
  const deviation = Math.abs(Math.log2(ratio));
  const limit = Math.log2(1 + TEMPO_LIMIT);
  const reachable = clamp01(1 - deviation / limit);
  // Un pas mic (sub 3%) sună mai curat decât unul de 9%, chiar dacă ambele se potrivesc.
  const comfort = clamp01(1 - Math.abs(ratio - 1) / TEMPO_LIMIT);
  return reachable * 0.7 + comfort * 0.3;
}

/**
 * Energia țintă a următoarei piese. Setul are o formă: urcă timp de 12 piese,
 * apoi lasă patru piese de revenire, ca să nu urce la infinit.
 */
export function energyTarget(currentEnergy, state) {
  if (currentEnergy == null) return null;
  const average = state?.energyAverage ?? currentEnergy;
  const played = state?.played ?? 0;
  const releasing = played > 0 && played % 16 >= 12;
  const lift = releasing ? -1.6 : currentEnergy <= average + 0.5 ? 1.4 : -1.2;
  return currentEnergy + lift;
}

export function noteEnergy(state, energy) {
  if (energy == null) return;
  state.energyAverage = state.energyAverage == null ? energy : state.energyAverage * 0.7 + energy * 0.3;
}

/** Cât de bine intră piesa după cea care cântă acum. */
export function trackFit(track, current, state) {
  const profile = getTrackProfile(track.id);
  const recent = state?.recent?.includes(track.id) ? -0.3 : 0;
  if (!profile?.bpm || !current?.bpm) return { score: 0.45 + recent, known: false };
  const tempo = tempoFit(profile.bpm, current.bpm) ?? 0.5;
  const level = profile.loudness != null && current.loudness != null
    ? clamp01(1 - Math.abs(profile.loudness - current.loudness) / 9)
    : 0.5;
  const timbre = profile.brightness != null && current.brightness != null
    ? clamp01(1 - Math.abs(profile.brightness - current.brightness) / 9)
    : 0.5;
  const target = energyTarget(current.energy, state);
  const energy = profile.energy != null && target != null
    ? clamp01(1 - Math.abs(profile.energy - target) / 7)
    : 0.5;
  return {
    score: tempo * 0.5 + level * 0.18 + timbre * 0.14 + energy * 0.18 + recent,
    known: true,
    tempo,
    energy: profile.energy ?? null,
  };
}

export function deckCurrent(deck) {
  return deckStats(deck);
}

/** Ordinea inteligentă pentru modul shuffle: cele mai bune potriviri întâi. */
export function orderByFit(pool, state, current, random = Math.random) {
  return pool
    .map((track) => ({ track, score: trackFit(track, current, state).score + random() * 0.05 }))
    .sort((a, b) => b.score - a.score)
    .map((row) => row.track);
}

export function energyOf(track) {
  const profile = getTrackProfile(track.id);
  return profile?.energy ?? null;
}