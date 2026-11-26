import { useEffect, useRef } from 'react';
import { captureDeckState } from '@/components/audio/deckContextRecovery';
import { setLocalAnalysisPaused } from '@/components/audio/localTrackAnalysis';

/** Release hardware only on a real unmount, not an effect cleanup/setup refresh. */
export function useAudioEngineLifetime({ ctxRef, outputsRef, cueAudioRef, decksRef,
  decksStateRef, routingRef, epochRef, cancelDeckStarts }) {
  const lifetimeRef = useRef(0);
  useEffect(() => {
    const lifetime = ++lifetimeRef.current;
    return () => queueMicrotask(() => {
      if (lifetimeRef.current !== lifetime) return;
      epochRef.current += 1;
      cancelDeckStarts();
      captureDeckState(decksRef.current, decksStateRef.current);
      setLocalAnalysisPaused(false);
      routingRef.current.version += 1;
      outputsRef.current.forEach(({ playback }) => playback.close());
      outputsRef.current.clear();
      const cue = cueAudioRef.current;
      if (cue) {
        cue.pause();
        cue.srcObject = null;
        cueAudioRef.current = null;
      }
      const context = ctxRef.current;
      ctxRef.current = null;
      if (context && context.state !== 'closed') context.close().catch(() => {});
    });
  }, [ctxRef, outputsRef, cueAudioRef, decksRef, decksStateRef, routingRef, epochRef, cancelDeckStarts]);
}