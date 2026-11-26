import { useCallback, useRef } from 'react';
import { playDeckAudio } from '@/lib/playDeckAudio';

export default function useDeckTransport({ decksRef, resume, patchDeck, isCalibrating, ensureContext }) {
  const starts = useRef(new Map());
  const cancelDeckStart = useCallback((index) => {
    starts.current.get(index)?.abort();
    starts.current.delete(index);
  }, []);
  const cancelDeckStarts = useCallback(() => {
    starts.current.forEach((controller) => controller.abort());
    starts.current.clear();
  }, []);
  const togglePlay = useCallback(async (index) => {
    if (isCalibrating()) return;
    ensureContext();
    const node = decksRef.current[index];
    if (!node?.audio.src) return;
    if (!node.audio.paused) {
      cancelDeckStart(index);
      node.audio.pause();
      patchDeck(index, { isPlaying: false, starting: false });
      return;
    }
    if (starts.current.has(index)) return;
    // La finalul piesei, Play repornește de la capăt, nu rămâne pe ultima secundă.
    if (node.audio.ended || (Number.isFinite(node.audio.duration) && node.audio.duration > 0 &&
      node.audio.currentTime >= node.audio.duration - 0.05)) {
      try { node.audio.currentTime = 0; } catch (e) { /* ignore */ }
      patchDeck(index, { progress: 0 });
    }
    const controller = new AbortController(), source = node.audio.getAttribute('src');
    starts.current.set(index, controller);
    const current = () => !controller.signal.aborted && node.audio.getAttribute('src') === source;
    patchDeck(index, { starting: true, playbackError: null });
    try {
      await resume();
      if (!current() || isCalibrating()) return;
      await playDeckAudio(node.audio, controller.signal);
      if (current()) patchDeck(index, { isPlaying: !node.audio.paused });
    } catch (error) {
      if (current() && error.name !== 'AbortError') patchDeck(index, {
        playbackError: error.name === 'NotSupportedError'
          ? 'Fișierul nu poate fi decodat. Alege altă piesă; piesa curentă continuă.'
          : error.message || 'Piesa nu a putut porni. Apasă din nou Redă.',
      });
    } finally {
      if (starts.current.get(index) === controller) {
        starts.current.delete(index);
        if (node.audio.getAttribute('src') === source) patchDeck(index, { starting: false });
      }
    }
  }, [decksRef, resume, patchDeck, isCalibrating, cancelDeckStart, ensureContext]);
  return { togglePlay, cancelDeckStart, cancelDeckStarts };
}