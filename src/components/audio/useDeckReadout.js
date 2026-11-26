import { useEffect } from 'react';

/** Position readout is UI work, not playback; retire the timer in stability mode. */
export default function useDeckReadout({ decksRef, ctxRef, crossfadeMotionRef, xGainsRef, crossRef,
  setCrossfadeState, setDecks, stabilityMode }) {
  useEffect(() => {
    if (stabilityMode) return;
    const id = setInterval(() => {
      if (!decksRef.current.length || document.hidden) return;
      const motion = crossfadeMotionRef.current, ctx = ctxRef.current;
      // Cu deckurile oprite, poziția nu se schimbă: nu mai re-randăm pagina de 5 ori pe secundă.
      const anyPlaying = decksRef.current.some(({ audio }) => !audio.paused && !audio.ended);
      if (!anyPlaying && !motion) return;
      if (motion && ctx) {
        const x = ctx.currentTime >= motion.end ? motion.target :
          Math.atan2(xGainsRef.current[1].gain.value, xGainsRef.current[0].gain.value) * 2 / Math.PI;
        crossRef.current = x;
        setCrossfadeState(x);
        if (ctx.currentTime >= motion.end) crossfadeMotionRef.current = null;
      }
      setDecks((prev) => {
        let changed = false;
        const next = prev.map((deck, i) => {
          const node = decksRef.current[i];
          if (!node || !deck.track) return deck;
          const audio = node.audio;
          const progress = audio.currentTime || 0;
          const duration = Number.isFinite(audio.duration) && audio.duration ? audio.duration : deck.duration;
          const playing = !audio.paused;
          if (deck.repeat && duration && audio.loopEnd !== duration) {
            try { audio.loopEnd = duration; } catch { /* Preserve native transport. */ }
          }
          if (Math.abs(progress - deck.progress) < 0.05 && duration === deck.duration && playing === deck.isPlaying) return deck;
          changed = true;
          return { ...deck, progress, duration, isPlaying: playing };
        });
        return changed ? next : prev;
      });
    }, 200);
    return () => clearInterval(id);
  }, [stabilityMode]);
}