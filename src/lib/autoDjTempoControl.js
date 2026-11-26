import { tempoBridge, advanceTempoRamp, reliableBeat } from '@/lib/autoDjTempo';
import { mixZone, protectedMoment } from '@/lib/autoDjStructure';

export function updateAutomaticTempo(d, st, config) {
  const ramp = st.tempoRamp;
  if (!ramp) return;
  const deck = d.decks[ramp.index], audio = d.getDeckAudio(ramp.index), ctx = d.getAudioContext();
  if (!config.beatmatch || !audio || !ctx || deck?.track?.id !== ramp.track) { st.tempoRamp = null; return; }
  const zone = mixZone(deck, audio.currentTime, audio.currentTime + 240 / deck.bpm);
  const hold = protectedMoment(deck, audio.currentTime) || (zone?.rising && ramp.target < audio.playbackRate);
  const step = advanceTempoRamp(ramp, audio, ctx.currentTime, hold);
  if (Math.abs(audio.playbackRate - step.rate) > 0.00005) d.setTempo(ramp.index, step.rate);
  if (step.done) st.tempoRamp = null;
}
export function prepareAutomaticTempo(d, st, config, incoming) {
  if (st.tempoPrepared || config.performanceMode !== 'max' || incoming?.analyzing) return;
  st.tempoPrepared = true;
  const outgoing = d.decks[st.activeDeck], audio = d.getDeckAudio(st.activeDeck);
  const bridge = tempoBridge(outgoing, incoming, audio, config);
  if (!bridge) return;
  d.setKeyLock(st.activeDeck, true); d.setKeyLock(st.incomingDeck, true);
  // O singură scriere de tempo, pe deckul încă mut — zero rescrieri pe piesa care cântă.
  d.setTempo(st.incomingDeck, bridge.inRate);
}
export function recoverNaturalTempo(d, st, config) {
  const audio = d.getDeckAudio(st.activeDeck);
  if (config.performanceMode !== 'max' || !config.beatmatch || !audio ||
    Math.abs(audio.playbackRate - 1) < 0.0001) return;
  // Never reset a live time-stretch engine after a fade: retain the matched
  // rate until the deck is silent. Loading another file resets its rate to 1.
  if (!audio.paused && !audio.ended) return;
  d.setKeyLock(st.activeDeck, true);
  d.setTempo(st.activeDeck, 1);
}