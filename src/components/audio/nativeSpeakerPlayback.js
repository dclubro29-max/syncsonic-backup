import { createSpeakerContextRoute } from '@/components/audio/speakerContextRoute';
import { resumeAudioContext } from '@/components/audio/resumeAudioContext';

export function supportsNativeSpeakerPlayback() {
  const Context = window.AudioContext || window.webkitAudioContext;
  return typeof Context?.prototype?.setSinkId === 'function';
}

/** Retain one native endpoint until selection changes; recovery never detaches its stream. */
export function createNativeSpeakerPlayback(mixer, input, deviceId) {
  const route = createSpeakerContextRoute(mixer, input, deviceId);
  let closed = false, startFailed = false, pending = null, cancelStart = () => {};
  const playback = {
    native: true, buffered: false, safetyMs: 0,
    getPlaybackStats: () => route.context.playbackStats ?? null,
    stats: { recoveries: 0, error: null }, started: false,
    get failed() { return startFailed || (!closed && route.context.state === 'closed'); },
    isActive: () => !closed && playback.started && mixer.state === 'running' && route.context.state === 'running',
    needsRecovery: () => !closed && playback.started && !playback.failed &&
      mixer.state === 'running' && ['suspended', 'interrupted'].includes(route.context.state),
    resume() {
      if (pending) return pending;
      if (!playback.needsRecovery()) return Promise.resolve();
      pending = resumeAudioContext(route.context).then(() => {
        if (!closed) { playback.stats.recoveries++; playback.stats.error = null; }
      }).catch((error) => {
        if (!closed) playback.stats.error = error.message || 'Boxa nu a putut relua redarea.';
        throw error;
      }).finally(() => { pending = null; });
      return pending;
    },
    setMuted: (value) => route.setMuted(value),
    close() {
      if (closed) return;
      closed = true;
      playback.started = false;
      cancelStart();
      route.close();
    },
  };
  playback.ready = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) { startFailed = true; playback.stats.error = error.message; reject(error); playback.close(); }
      else { playback.started = true; resolve(); }
    };
    const timer = setTimeout(() => finish(new Error('Boxa nu a pornit în 8 secunde. Verifică legătura audio și reselectează ieșirea.')), 8000);
    cancelStart = () => finish(new DOMException('Ieșirea audio a fost închisă.', 'AbortError'));
    route.start().then(() => { if (!closed) finish(); }, finish);
  });
  return playback;
}