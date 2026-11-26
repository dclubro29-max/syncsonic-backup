import { useCallback, useEffect, useRef, useState } from 'react';
import { PARTY_MAX_CONFIG } from '@/lib/djMaxConfig';
import { scheduleDeckPerformance } from '@/lib/autoDjPerformance';

/** One effects owner: Auto DJ schedules Party MAX during a set; manual decks use the same stage. */
export function usePartyMode(dj, autoDj) {
  const [manualOn, setManualOn] = useState(false);
  const [manualStyle, setStyleState] = useState('build');
  const [manualIntensity, setIntensityState] = useState(1);
  const automatic = !!autoDj?.on;
  const automaticParty = automatic && !!autoDj.config.partyMax && !!autoDj.config.performance;
  const style = automaticParty ? autoDj.config.partyStyle || 'build' : manualStyle;
  const intensity = automaticParty ? autoDj.config.intensity : manualIntensity;
  const on = !dj.stabilityMode && (automatic ? automaticParty : manualOn);
  const enabled = manualOn && !automatic && !dj.stabilityMode;
  const djRef = useRef(dj), autoRef = useRef(autoDj), settingsRef = useRef({ style, intensity });
  const statesRef = useRef({}), touchedRef = useRef(new Set());
  djRef.current = dj;
  autoRef.current = autoDj;
  settingsRef.current = { style, intensity };

  const setOn = useCallback((value) => {
    const d = djRef.current, a = autoRef.current;
    if (value && (d.isCalibrating() || d.isEmergencyPlayback?.() || d.isStabilityMode?.())) return;
    if (a.on) {
      setManualOn(false);
      if (value) a.startMax({ ...PARTY_MAX_CONFIG, partyStyle: settingsRef.current.style,
        intensity: settingsRef.current.intensity });
      else a.setConfig({ partyMax: false, performance: false, transitionFx: false });
    } else {
      if (value) { d.ensureAudio(); d.enableDjProcessing(); }
      setManualOn(value);
    }
  }, []);
  const setStyle = useCallback((value) => {
    setStyleState(value);
    settingsRef.current.style = value;
    if (autoRef.current.on && autoRef.current.config.partyMax) autoRef.current.setConfig({ partyStyle: value });
  }, []);
  const setIntensity = useCallback((value) => {
    const amount = Math.max(0.2, Math.min(1, value));
    setIntensityState(amount);
    settingsRef.current.intensity = amount;
    if (autoRef.current.on && autoRef.current.config.partyMax) autoRef.current.setConfig({ intensity: amount });
  }, []);

  useEffect(() => { if (automatic) setManualOn(false); }, [automatic]);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const d = djRef.current, ctx = d.getAudioContext();
      if (!ctx || d.isStabilityMode?.()) return;
      const cfg = { ...PARTY_MAX_CONFIG, partyStyle: settingsRef.current.style, intensity: settingsRef.current.intensity };
      d.decks.forEach((deck, i) => {
        if (!deck.track) return;
        const state = statesRef.current[i] ||= {};
        if (d.neutral || d.abBypass || d.isCalibrating()) {
          if (state.enabled) d.resetDeckPerformance(i);
          statesRef.current[i] = {};
          return;
        }
        const plan = scheduleDeckPerformance({ stage: d.getPerformanceStage(i), ctx, deck,
          audio: d.getDeckAudio(i), cfg, state });
        if (plan) { touchedRef.current.add(i); d.automateDeckPerformance(i, plan); }
      });
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => {
      clearInterval(timer);
      // Auto DJ resets the stage when taking over; do not cancel its new automation.
      if (!autoRef.current.on) touchedRef.current.forEach((i) => djRef.current.resetDeckPerformance(i));
      touchedRef.current.clear();
      statesRef.current = {};
    };
  }, [enabled]);

  return { on, setOn, style, setStyle, intensity, setIntensity, suspended: false };
}