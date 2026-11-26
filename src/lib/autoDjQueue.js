import { orderByFit, trackFit, deckCurrent, energyOf, noteEnergy } from '@/lib/djMaxSelection';

/**
 * Coada librăriei locale pentru DJ MAX / MAX ULTRA. Nicio piesă respinsă în
 * sesiune nu revine. Ordinea ține cont de tempo, nivel, timbru și de curba de
 * energie a setului, nu doar de ordinea fișierelor.
 */

/** Sub acest scor, trecerea pe următoarea piesă ar suna ca o ruptură. */
const WEAK_FIT = 0.34;

function playlistOrder(pool, tracks, currentId) {
  const order = [];
  const start = tracks.findIndex((track) => track.id === currentId);
  for (let offset = 1; offset <= tracks.length; offset += 1) {
    const track = tracks[(start + offset + tracks.length) % tracks.length];
    if (pool.some((candidate) => candidate.id === track.id)) order.push(track);
  }
  return order;
}

function smartOrder(pool, state, current, random) {
  return orderByFit(pool, state, current, random);
}

export function selectAutoDjTrack(state, tracks, config, current, random = Math.random) {
  const currentDeck = typeof current === 'string' ? null : current;
  const currentId = typeof current === 'string' ? current : current?.track?.id;
  const available = tracks.filter((track) => !state.blocked.includes(track.id));
  state.queue = state.queue.filter((queued) => available.some((track) => track.id === queued.id));
  const currentStats = deckCurrent(currentDeck);
  const smart = config.performanceMode === 'max' && config.smartSelect !== false;
  if (!state.queue.length) {
    const alternatives = available.filter((track) => track.id !== currentId);
    const pool = alternatives.length ? alternatives : available;
    if (config.shuffle) {
      state.queue = smartOrder(pool, state, currentStats, random);
    } else {
      const order = playlistOrder(pool, tracks, currentId);
      // Ordinea bibliotecii rămâne, dar o piesă care nu se leagă e amânată cu
      // câteva poziții, nu scoasă din set.
      const weak = order[0] && smart ? trackFit(order[0], currentStats, state).score < WEAK_FIT : false;
      if (order.length > 1 && weak) {
        const fit = order.findIndex((track, index) =>
          index > 0 && index < Math.min(6, order.length) &&
          trackFit(track, currentStats, state).score >= WEAK_FIT);
        if (fit > 0) order.unshift(order.splice(fit, 1)[0]);
      }
      state.queue = order;
    }
  }
  const next = state.queue.shift() || null;
  if (next) noteEnergy(state, energyOf(next));
  return next;
}

export function rejectAutoDjTrack(state, id) {
  if (id && !state.blocked.includes(id)) state.blocked.push(id);
  state.queue = state.queue.filter((track) => track.id !== id);
}

/**
 * Reordonează ce a mai rămas din coadă după fiecare tranziție. Piesa deja
 * pregătită nu se atinge; restul se așază din nou după tempo, nivel și energia
 * de acum, ca setul să curgă în loc să rămână pe ordinea de la început.
 */
export function rerankQueue(state, tracks, config, current) {
  if (!state.queue.length || state.queue.length < 2) return;
  if (config.performanceMode !== 'max' || config.smartSelect === false) return;
  const pool = state.queue.filter((track) => tracks.some((t) => t.id === track.id));
  if (pool.length < 2) return;
  state.queue = orderByFit(pool, state, deckCurrent(current));
}