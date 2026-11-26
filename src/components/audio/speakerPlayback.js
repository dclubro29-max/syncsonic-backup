import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';
import { createDirectSpeakerPlayback } from '@/components/audio/directSpeakerPlayback';
import { manageSpeakerMedia } from '@/components/audio/speakerMediaRecovery';
import bindSpeakerMediaStart from '@/components/audio/speakerMediaStart';

/** One persistent stereo stream/player per physical sink, with no extra AudioContext. */
export function createSpeakerPlayback(context, input, deviceId, { direct = false, deferStart = false } = {}) {
  if (direct) return createDirectSpeakerPlayback(context, input);
  const destination = context.createMediaStreamDestination();
  destination.channelCount = 2;
  destination.channelCountMode = 'explicit';
  const audio = new Audio();
  audio.autoplay = false;
  audio.loop = false;
  audio.playsInline = true;
  audio.setAttribute('playsinline', 'true');
  audio.setAttribute('webkit-playsinline', 'true');
  audio.volume = 1;
  audio.srcObject = destination.stream;
  const sinkId = deviceId === SYSTEM_DEFAULT_ID ? '' : deviceId;
  let closed = false;
  let rejectClosed = () => {};
  let fadeTimer = null;

  // Reconnectarea nu trebuie să apară ca un salt de volum.
  const fadeIn = () => {
    const startedAt = performance.now();
    audio.volume = 0;
    clearInterval(fadeTimer);
    fadeTimer = setInterval(() => {
      if (closed) {
        clearInterval(fadeTimer);
        return;
      }
      const progress = Math.min(1, (performance.now() - startedAt) / 350);
      audio.volume = progress;
      if (progress >= 1) clearInterval(fadeTimer);
    }, 25);
  };

  const open = async () => {
    if (closed) return;
    audio.volume = 0;
    // Pornim elementul cât timp gestul utilizatorului este încă activ, apoi
    // mutăm ieșirea. setSinkId poate dura; dacă ar fi așteptat întâi, a doua
    // boxă ar pierde gestul și ar rămâne mută.
    const playPromise = audio.play();
    playPromise.catch(() => {});
    try {
      if (typeof audio.setSinkId === 'function') {
        if (audio.sinkId !== sinkId) await audio.setSinkId(sinkId);
      } else if (sinkId) {
        throw new Error('Browserul nu permite selectarea acestei boxe. Alege ieșirea implicită a sistemului.');
      }
      await playPromise;
    } catch (error) {
      try { audio.pause(); } catch (e) { /* ignore */ }
      throw error;
    }
    if (closed) return;
    playback.started = true;
    playback.startedAt = performance.now();
    media.markProgress();
    fadeIn();
  };
  const playback = {
    audio,
    isolated: true,
    buffered: false,
    safetyMs: 0,
    stats: { recoveries: 0, error: null },
    failed: false,
    started: false,
    startedAt: 0,
    isActive: () => !closed && playback.started && !audio.paused && !audio.ended && !audio.error && !playback.stats.error,
    needsRecovery: () => media.needsRecovery(),
    resume: () => {
      const wasPaused = audio.paused;
      if (wasPaused) audio.volume = 0;
      return media.resume().then(() => {
        if (wasPaused && !closed) fadeIn();
      });
    },
    setMuted(value) {
      audio.muted = value;
    },
    close() {
      if (closed) return;
      closed = true;
      playback.started = false;
      clearInterval(fadeTimer);
      media.close();
      rejectClosed();
      try {
        input.disconnect(destination);
      } catch (e) {
        /* ignore */
      }
      try {
        audio.pause();
        audio.srcObject = null;
      } catch (e) {
        /* ignore */
      }
      destination.stream.getTracks().forEach((track) => track.stop());
      destination.disconnect();
    },
  };
  const media = manageSpeakerMedia(audio, destination.stream, playback, context);

  input.connect(destination);
  rejectClosed = bindSpeakerMediaStart(playback, open, { deferStart });
  return playback;
}