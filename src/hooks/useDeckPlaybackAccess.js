import { useCallback } from 'react';

/** Stable accessors read the live audio graph rather than UI progress. */
export default function useDeckPlaybackAccess(decksRef, xGainsRef, { masterRef, ctxRef, movieRef }) {
  const getDeckAudio = useCallback((i) => decksRef.current[i]?.audio || null, [decksRef]);
  const getDeckMixGain = useCallback((i) => {
    const level = decksRef.current[i]?.gain.gain.value ?? 0;
    return level * (i < 2 ? xGainsRef.current[i]?.gain.value ?? 0 : 1);
  }, [decksRef, xGainsRef]);
  const getMasterInput = useCallback(() => masterRef.current, [masterRef]);
  const getAudioContext = useCallback(() => ctxRef.current, [ctxRef]);
  const isPlaybackActive = useCallback(() =>
    decksRef.current.some(({ audio }) => !audio.paused && !audio.ended) ||
    !!(movieRef.current.element && !movieRef.current.element.paused && !movieRef.current.element.ended), [decksRef, movieRef]);
  return { getDeckAudio, getDeckMixGain, getMasterInput, getAudioContext, isPlaybackActive };
}