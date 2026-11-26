import { useCallback } from 'react';
import { resumeAudioContext } from '@/components/audio/resumeAudioContext';
import { restoreSpeakerPlayback } from '@/components/audio/playbackEmergencyGate';
import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';

export default function useAudioStartup({ ensureContext, outputsRef, desiredSpeakersRef,
  defaultGainRef, outputVolumeRef, applyOutputs, restoreMasterVolume, setPlaybackError, epochRef }) {
  return useCallback(async () => {
    const epoch = epochRef.current;
    const ctx = ensureContext();
    const check = () => {
      if (epoch !== epochRef.current) throw new DOMException('Pornirea a fost anulată.', 'AbortError');
    };
    // Reissue resume inside each gesture; a blocked background promise is never reused.
    const mixerStart = resumeAudioContext(ctx);
    outputsRef.current.forEach(({ playback }) => {
      if (!playback.failed) playback.resume?.().catch(() => {});
    });
    try {
      await mixerStart;
      check();
      restoreMasterVolume();
      restoreSpeakerPlayback(ctx, outputsRef.current, defaultGainRef.current,
        outputVolumeRef.current[SYSTEM_DEFAULT_ID] ?? 1);
      const wanted = desiredSpeakersRef.current;
      // Healthy routes stay connected; rebuild only a missing or failed endpoint.
      if (outputsRef.current.size !== wanted.length ||
        wanted.some(({ deviceId }) => !outputsRef.current.has(deviceId)) ||
        [...outputsRef.current.values()].some(({ playback }) => playback.failed || !playback.started)) {
        await applyOutputs();
      }
      check();
      setPlaybackError(null);
      return ctx;
    } catch (error) {
      if (error.name !== 'AbortError') setPlaybackError(error.message || 'Sunetul nu a putut porni. Apasă din nou Redă.');
      throw error;
    }
  }, [ensureContext, outputsRef, desiredSpeakersRef, defaultGainRef, outputVolumeRef,
    applyOutputs, restoreMasterVolume, setPlaybackError, epochRef]);
}