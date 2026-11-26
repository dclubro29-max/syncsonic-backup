import { useEffect, useRef } from 'react';
import { useDj } from '@/lib/djContext';
import {
  bindSessionActions,
  setSessionMetadata,
  setSessionPlaybackState,
  setSessionPosition,
} from '@/lib/mediaSession';

/**
 * Telefonul controlează setul direct de pe ecranul blocat, fără să țină
 * aplicația deschisă: titlul piesei, play/pauză, următoarea și poziția.
 */
export default function MediaSessionBridge() {
  const dj = useDj();
  const djRef = useRef(dj);
  djRef.current = dj;

  const audible = () => {
    const d = djRef.current;
    const playing = d.decks
      .map((deck, index) => ({ deck, index }))
      .filter(({ deck }) => deck.isPlaying && deck.track);
    if (!playing.length) return d.decks.findIndex((deck) => deck.track);
    if (playing.length === 1) return playing[0].index;
    return d.crossfade >= 0.5 ? 1 : 0;
  };

  const trackId = (() => {
    const index = audible();
    return index >= 0 ? dj.decks[index]?.track?.id : null;
  })();

  useEffect(() => {
    const index = audible();
    if (index >= 0 && dj.decks[index]?.track) setSessionMetadata(dj.decks[index].track);
  }, [trackId]);

  useEffect(() => {
    const playing = dj.decks.some((deck) => deck.isPlaying);
    setSessionPlaybackState(playing ? 'playing' : dj.autoDj.on ? 'playing' : 'paused');
  }, [dj.decks, dj.autoDj.on]);

  useEffect(() => {
    return bindSessionActions({
      play: () => {
        const d = djRef.current;
        const index = audible();
        if (index >= 0 && !d.decks[index]?.isPlaying) d.togglePlay(index);
      },
      pause: () => {
        const d = djRef.current;
        if (d.autoDj.on) {
          d.autoDj.setOn(false);
          return;
        }
        d.decks.forEach((deck, index) => {
          if (deck.isPlaying) d.togglePlay(index);
        });
      },
      stop: () => {
        const d = djRef.current;
        if (d.autoDj.on) d.autoDj.setOn(false);
        d.decks.forEach((deck, index) => {
          if (deck.isPlaying) d.togglePlay(index);
        });
      },
      nexttrack: () => {
        const d = djRef.current;
        if (d.autoDj.on) d.autoDj.skip();
      },
      previoustrack: () => {
        const d = djRef.current;
        const index = audible();
        if (index >= 0) d.seek(index, 0);
      },
      seekbackward: () => {
        const d = djRef.current;
        const index = audible();
        const audio = d.getDeckAudio(index);
        if (audio) d.seek(index, Math.max(0, audio.currentTime - 15));
      },
      seekforward: () => {
        const d = djRef.current;
        const index = audible();
        const audio = d.getDeckAudio(index);
        if (audio && Number.isFinite(audio.duration)) d.seek(index, Math.min(audio.duration, audio.currentTime + 15));
      },
      seekto: (details) => {
        const d = djRef.current;
        const index = audible();
        if (index >= 0 && details && Number.isFinite(details.seekTime)) d.seek(index, details.seekTime);
      },
    });
  }, []);

  useEffect(() => {
    if (dj.stabilityMode) return;
    const timer = setInterval(() => {
      const d = djRef.current;
      const index = audible();
      const audio = d.getDeckAudio(index);
      if (!audio) return;
      setSessionPosition(audio.currentTime, audio.duration, audio.playbackRate);
    }, 1000);
    return () => clearInterval(timer);
  }, [dj.stabilityMode]);

  return null;
}