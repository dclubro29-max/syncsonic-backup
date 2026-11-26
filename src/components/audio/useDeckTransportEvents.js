import { useEffect } from 'react';

/** Stability has no progress timer: only transport events update the controls. */
export default function useDeckTransportEvents(decksRef, context, enabled, patchDeck) {
  useEffect(() => {
    if (!context) return;
    const events = ['play', 'pause', 'ended', 'loadedmetadata', 'durationchange', 'error', 'emptied'];
    const bindings = decksRef.current.map(({ audio }, index) => {
      const update = () => patchDeck(index, (deck) => {
        if (!deck.track || audio.getAttribute('src') !== deck.track.url) return {};
        return {
          isPlaying: !audio.paused && !audio.ended,
          duration: Number.isFinite(audio.duration) ? audio.duration : deck.duration,
          playbackError: audio.error ? 'Piesa nu poate fi redată. Alege alt fișier.' : deck.playbackError,
        };
      });
      events.forEach((event) => audio.addEventListener(event, update));
      update();
      return { audio, update };
    });
    return () => bindings.forEach(({ audio, update }) => events.forEach((event) => audio.removeEventListener(event, update)));
  }, [decksRef, context, enabled, patchDeck]);
}