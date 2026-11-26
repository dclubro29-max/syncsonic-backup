import { useCallback, useRef, useState } from 'react';
import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';

const KEY = 'musicsync.outputVolumes';
const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
};

/** Independent of the master fader and the temporary calibration mute gates. */
export function useOutputVolume({ ctxRef, outputsRef, defaultGainRef, snapshotOutputs }) {
  const [outputVolumes, setVolumes] = useState(read);
  const outputVolumeRef = useRef(outputVolumes);
  const setOutputVolume = useCallback((id, value) => {
    if (!Number.isFinite(value)) return;
    const level = Math.max(0, Math.min(1, value));
    const next = { ...outputVolumeRef.current, [id]: level };
    outputVolumeRef.current = next;
    setVolumes(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    const output = outputsRef.current.get(id);
    const param = output?.volumeGain.gain ||
      (id === SYSTEM_DEFAULT_ID && !outputsRef.current.size ? defaultGainRef.current?.gain : null);
    if (param && ctxRef.current) param.setTargetAtTime(level, ctxRef.current.currentTime, 0.015);
    if (output) { output.volume = level; snapshotOutputs(); }
  }, [ctxRef, outputsRef, defaultGainRef, snapshotOutputs]);
  return { outputVolumes, outputVolumeRef, setOutputVolume };
}