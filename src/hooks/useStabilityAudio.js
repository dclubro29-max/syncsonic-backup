import { useCallback, useRef, useState } from 'react';
import setStabilityDeckRoute from '@/components/audio/stabilityDeckRoute';
import setStabilityOutputRoute from '@/components/audio/stabilityOutputRoute';
import { setLocalAnalysisPaused } from '@/components/audio/localTrackAnalysis';
import { applyDeckState } from '@/lib/deckGraph';

export default function useStabilityAudio(options) {
  const current = useRef(options);
  current.current = options;
  const [stabilityMode, setState] = useState(false);
  const setStabilityMode = useCallback((enabled) => {
    const o = current.current;
    if (o.stabilityRef.current === enabled) return;
    if (o.emergencyRef.current || o.isCalibrating()) return;
    o.stabilityRef.current = enabled;
    setLocalAnalysisPaused(enabled);
    o.stabilityMasterRef.current?.(enabled);
    o.decksRef.current.forEach((node, i) => {
      setStabilityDeckRoute(node, o.xGainsRef.current[i] || o.masterRef.current, o.cueBusRef.current, enabled);
      if (!enabled) {
        const deck = o.decksStateRef.current[i];
        node.audio.preservesPitch = deck.keyLock;
        if (!o.processingStateRef.current.neutral && !o.processingStateRef.current.abBypass) {
          applyDeckState(node, o.ramp, deck, { keepTempo: true });
        }
      }
    });
    o.outputsRef.current.forEach((output) => setStabilityOutputRoute(o.postRef.current, output, enabled));
    o.applyCueDevice(enabled ? null : o.cueDeviceRef.current);
    o.setDecks((prev) => prev.map((deck, i) => ({ ...deck,
      analyzing: enabled ? false : deck.analyzing,
      isPlaying: !!o.decksRef.current[i] && !o.decksRef.current[i].audio.paused && !o.decksRef.current[i].audio.ended,
    })));
    o.snapshotOutputs();
    setState(enabled);
    if (!enabled) o.decksStateRef.current.forEach((deck, i) => {
      if (deck.track && !deck.peaks?.length) o.analyze(i, deck.track);
    });
  }, []);
  return { stabilityMode, setStabilityMode };
}