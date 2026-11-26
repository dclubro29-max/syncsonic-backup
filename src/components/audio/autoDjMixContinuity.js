import { restoreTransitionEq } from '@/lib/autoDjTransitionAudio';
import { resetPerformanceState } from '@/lib/autoDjPerformance';

/** Never finish a scheduled fade into a deck whose decoder stopped supplying audio. */
export function interruptStarvedMix(dj, state) {
  const incoming = dj.getDeckAudio(state.incomingDeck);
  if (incoming && !incoming.error && !incoming.paused && !incoming.ended &&
    !incoming.seeking && incoming.readyState >= 3) return false;
  // The outgoing source is never paused here. Hold it audible while the next
  // deck buffers again, rather than allowing the scheduled fader to reach silence.
  dj.setCrossfade(state.activeDeck === 0 ? 0 : 1);
  [0, 1].forEach((index) => {
    dj.resetDeckAutomation(index, { keepTempo: true });
    dj.resetDeckPerformance(index);
  });
  restoreTransitionEq(dj, state);
  state.eqBaseline = null;
  state.filterBaseline = null;
  state.bassSwap = false;
  state.phase = 'preparing';
  state.preparedAt = Date.now();
  state.mixEnd = 0;
  state.tempoRamp = null;
  state.tempoPrepared = false;
  state.incomingTempo = null;
  state.mixBaseTempo = null;
  resetPerformanceState(state.perf);
  incoming?.pause();
  if (!incoming || incoming.error || incoming.ended) {
    throw Object.assign(new Error('Piesa următoare s-a oprit; păstrez piesa curentă și aleg alta.'),
      { name: 'TrackPlaybackError' });
  }
  return true;
}