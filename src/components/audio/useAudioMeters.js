import { useCallback, useRef } from 'react';
import { meterFrom } from '@/lib/deckState';

export function useAudioMeters({ decksRef, masterAnalyserRef, preLimiterAnalyserRef, postLimiterAnalyserRef, limiterRef, stabilityRef }) {
  const meter = useRef(null), spectrum = useRef(null);
  const readMeter = useCallback((analyser) => {
    if (stabilityRef?.current || !analyser) return { level: 0, peak: 0 };
    if (meter.current?.length !== analyser.fftSize) meter.current = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(meter.current);
    return meterFrom(meter.current);
  }, []);
  const getDeckMeter = useCallback((i) => readMeter(decksRef.current[i]?.analyser), [decksRef, readMeter]);
  const getMasterMeter = useCallback(() => readMeter(masterAnalyserRef.current), [masterAnalyserRef, readMeter]);
  const getPreLimiterMeter = useCallback(() => readMeter(preLimiterAnalyserRef?.current), [preLimiterAnalyserRef, readMeter]);
  const getPostLimiterMeter = useCallback(() => readMeter(postLimiterAnalyserRef?.current), [postLimiterAnalyserRef, readMeter]);
  const getLimiterReduction = useCallback(() => Math.max(0, -(limiterRef.current?.reduction || 0)), [limiterRef]);
  const getSpectrum = useCallback(() => {
    const analyser = masterAnalyserRef.current;
    if (stabilityRef?.current || !analyser) return null;
    if (spectrum.current?.length !== analyser.frequencyBinCount) spectrum.current = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(spectrum.current);
    return spectrum.current;
  }, [masterAnalyserRef]);
  return { getDeckMeter, getMasterMeter, getPreLimiterMeter, getPostLimiterMeter, getLimiterReduction, getSpectrum };
}