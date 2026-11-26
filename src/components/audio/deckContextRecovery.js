import { applyDeckState } from '@/lib/deckGraph';

/** Preserve transport before retiring sources attached to an irreversibly closed context. */
export function captureDeckState(nodes, states) {
  return states.map((state, index) => {
    const node = nodes[index];
    if (!node) return state;
    const saved = { ...state, progress: node.audio.currentTime || state.progress || 0,
      tempo: node.audio.playbackRate, isPlaying: false, starting: false };
    clearTimeout(node.revSend?.idleTimer);
    clearTimeout(node.performance?.reverbSend?.idleTimer);
    node.echoLifecycle?.dispose();
    node.performance?.echoLifecycle?.dispose();
    node.performance?.roll?.lifecycle?.dispose();
    node.audio.pause();
    node.audio.removeAttribute('src');
    node.audio.load();
    node.src.disconnect();
    return saved;
  });
}

/** Restore controls and position, but require Play to unlock a new audio context. */
export function restoreDeckState(node, state, ramp, neutral = false) {
  if (!state?.track?.url) return;
  const audio = node.audio;
  applyDeckState(node, ramp, neutral ? { ...state, tempo: 1, trim: 1, autoTrim: 1,
    eq: { low: 0, mid: 0, high: 0 }, fx: { echo: 0, reverb: 0, filter: 0, karaoke: 0 } } : state);
  node.gain.gain.value = state.volume;
  node.monitorSend.gain.value = state.monitor ? 1 : 0;
  audio.preservesPitch = state.keyLock !== false;
  audio.loop = !!state.loop || !!state.repeat;
  audio.loopStart = state.loop?.start || 0;
  audio.loopEnd = state.loop?.end || (state.repeat ? state.duration || 0 : 0);
  const restorePosition = () => {
    if (audio.getAttribute('src') !== state.track.url || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(state.progress || 0, audio.duration));
  };
  audio.addEventListener('loadedmetadata', restorePosition, { once: true });
  audio.src = state.track.url;
  audio.load();
}