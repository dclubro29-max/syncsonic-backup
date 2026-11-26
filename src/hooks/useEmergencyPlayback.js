import { useCallback, useRef, useState } from 'react';
import { EMERGENCY_DJ_CONFIG } from '@/components/audio/emergencyDjConfig';
import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';

/** Explicit, reversible event fallback; never silently drop the selected speakers. */
export default function useEmergencyPlayback(options) {
  const current = useRef(options), backup = useRef(null), pending = useRef(false);
  current.current = options;
  const [state, setState] = useState({ on: false, busy: false, error: null, speaker: null });
  const restore = useCallback(async () => {
    const { dj, autoDj, setAllSpeakers } = current.current;
    const saved = backup.current;
    autoDj.setOn(false);
    dj.panicStop();
    dj.setEmergencyPlayback(false);
    if (saved) {
      autoDj.setConfig({ ...saved.config, on: false });
      setAllSpeakers(saved.speakers.map((speaker) => speaker.deviceId));
      await dj.setOutputs(saved.speakers);
    }
    backup.current = null;
  }, []);
  const start = useCallback(async (deviceId) => {
    if (pending.current) return false;
    pending.current = true;
    setState((s) => ({ ...s, busy: true, error: null }));
    const { dj, autoDj, partyMode, selectedSpeakers, setAllSpeakers, tracks, speakers } = current.current;
    try {
      if (!tracks.length) throw new Error('Adaugă întâi piese în biblioteca locală.');
      if (dj.isCalibrating()) throw new Error('Oprește calibrarea înainte de redarea de urgență.');
      const Context = window.AudioContext || window.webkitAudioContext;
      if (deviceId !== SYSTEM_DEFAULT_ID && typeof Context?.prototype?.setSinkId !== 'function') {
        throw new Error('Pentru redare directă, alege ieșirea implicită și setează boxa în sistem.');
      }
      backup.current = { config: { ...autoDj.config }, speakers: [...selectedSpeakers] };
      autoDj.setOn(false);
      dj.panicStop();
      dj.setEmergencyPlayback(true);
      partyMode.setOn(false);
      setAllSpeakers([deviceId]);
      await dj.setOutputs([{ deviceId }]);
      await dj.ensureAudio();
      if (!dj.isDirectOutput(deviceId)) throw new Error('Ieșirea directă nu a pornit. Alege altă boxă sau ieșirea implicită.');
      autoDj.setConfig(EMERGENCY_DJ_CONFIG);
      autoDj.setOn(true);
      setState({ on: true, busy: false, error: null, speaker: speakers.find((s) => s.deviceId === deviceId)?.label || 'Boxă selectată' });
      return true;
    } catch (error) {
      let message = error.message || 'Redarea de urgență nu a pornit.';
      if (backup.current) {
        try { await restore(); }
        catch (restoreError) { message += ` Restaurarea nu s-a încheiat: ${restoreError.message}`; }
      }
      setState({ on: false, busy: false, error: message, speaker: null });
      return false;
    } finally { pending.current = false; }
  }, [restore]);
  const stop = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      await restore();
      setState({ on: false, busy: false, error: null, speaker: null });
    } catch (error) {
      setState((s) => ({ ...s, on: false, busy: false, error: error.message }));
    } finally { pending.current = false; }
  }, [restore]);
  return { ...state, start, stop };
}