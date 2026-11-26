import { useCallback, useRef, useState } from 'react';
import { readMasterVolume, storeMasterVolume } from '@/lib/masterVolumeStore';

/** One authority for the actual output level, persistence and volume lock. */
export function useMasterVolume({ ctxRef, volumeNodeRef }) {
  const [settings, setSettings] = useState(readMasterVolume);
  const volumeStateRef = useRef(settings);
  const mutedRef = useRef(false);

  const apply = useCallback((immediate = false) => {
    const param = volumeNodeRef.current?.gain;
    const ctx = ctxRef.current;
    if (!param || !ctx) return;
    const level = mutedRef.current ? 0 : volumeStateRef.current.level;
    const now = ctx.currentTime;
    const current = param.value;
    // Remove any old automation so it cannot raise the level later.
    param.cancelScheduledValues(now);
    param.setValueAtTime(immediate ? level : current, now);
    if (!immediate) param.setTargetAtTime(level, now, 0.007);
  }, [ctxRef, volumeNodeRef]);

  const commit = useCallback((next) => {
    volumeStateRef.current = next;
    setSettings(next);
    storeMasterVolume(next);
    apply(next.locked !== null);
  }, [apply]);

  const setMasterVolume = useCallback((value) => {
    // Check the synchronous guard, not a render snapshot or a later effect.
    if (volumeStateRef.current.locked !== null || !Number.isFinite(value)) return;
    commit({ level: Math.max(0, Math.min(1, value)), locked: null });
  }, [commit]);

  const toggleVolumeLock = useCallback(() => {
    const { level, locked } = volumeStateRef.current;
    commit({ level, locked: locked === null ? level : null });
  }, [commit]);

  const muteMasterVolume = useCallback(() => {
    mutedRef.current = true;
    apply(true);
  }, [apply]);
  const restoreMasterVolume = useCallback(() => {
    mutedRef.current = false;
    apply(true);
  }, [apply]);

  return { masterVolume: settings.level, volumeLock: settings.locked,
    volumeStateRef, setMasterVolume, toggleVolumeLock, muteMasterVolume, restoreMasterVolume };
}