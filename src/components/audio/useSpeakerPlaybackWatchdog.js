import { useEffect, useState } from 'react';
import { getMixerHardwareReference } from '@/components/audio/mixerHardwareReference';
import { pushAudioEvent } from '@/lib/audioDiagnostics';

/** Protect the shared mixer as well as endpoints; never recreate a healthy graph. */
export function useSpeakerPlaybackWatchdog(outputsRef, ctxRef, decksRef, movieRef, engineContext, repairOutputs, stabilityMode = false, desiredSpeakersRef) {
  const [protection, setProtection] = useState({ protectedOutputs: 0, compatibilityOutputs: 0, bufferMs: 0, recoveries: 0, underruns: 0, error: null });
  useEffect(() => {
    const context = engineContext;
    if (!context) return;
    let closed = false, recovering = null, repairing = null, retryAt = 0, mainRecoveries = 0, mainError = null;
    const lastLogged = { recoveries: 0, underruns: 0, error: null };
    const playing = () => decksRef.current.some(({ audio }) => !audio.paused && !audio.ended) ||
      (movieRef.current.element && !movieRef.current.element.paused && !movieRef.current.element.ended);
    const snapshot = () => {
      if (closed) return;
      const outputs = [...outputsRef.current.values()];
      const active = outputs.filter(({ playback }) => playback?.started && !playback.failed &&
        (playback.isActive?.() ?? !playback.audio?.paused));
      const nativeOutputs = active.filter(({ playback }) => playback.direct || playback.native).length;
      const reference = getMixerHardwareReference(context);
      const isolatedClock = reference.pinned;
      const isolatedOutputs = active.filter(({ playback }) => playback.isolated).length;
      const fallback = outputs.length === 0 && context.state === 'running' ? 1 : 0;
      const renderReports = [context.playbackStats, ...outputs.map(({ playback }) => playback.getPlaybackStats?.())]
        .filter((stats) => Number.isFinite(stats?.underrunEvents));
      const next = {
        renderUnderruns: renderReports.length ? renderReports.reduce((sum, stats) => sum + stats.underrunEvents, 0) : null,
        renderUnderrunMs: renderReports.reduce((sum, stats) => sum + (stats.underrunDuration || 0) * 1000, 0),
        protectedOutputs: context.state === 'running' ? active.length + fallback : 0,
        compatibilityOutputs: active.length - nativeOutputs,
        nativeOutputs,
        isolatedClock,
        isolatedOutputs,
        clockNotice: desiredSpeakersRef?.current.length > 1 ? reference.notice : null,
        bufferMs: 0,
        recoveries: mainRecoveries + outputs.reduce((sum, { playback }) => sum + (playback.stats.recoveries || 0), 0),
        underruns: outputs.reduce((sum, { playback }) => sum + (playback.stats.underruns || 0) + (playback.stats.transportGaps || 0), 0),
        error: mainError || (context.state === 'closed' ? 'Motorul audio s-a închis. Apasă Play pentru a-l reconstrui fără să pierzi piesele încărcate.' : null) ||
          outputs.find(({ playback }) => playback.stats.error)?.playback.stats.error ||
          (outputs.some(({ playback }) => playback.failed) ? 'O ieșire audio s-a închis; refac doar boxa afectată.' : null),
      };
      if (stabilityMode) {
        // Keep routing/error changes visible, without streaming render statistics into React.
        delete next.renderUnderruns;
        delete next.renderUnderrunMs;
      }
      setProtection((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      if (next.recoveries > lastLogged.recoveries) {
        pushAudioEvent('recovery', `Reluare automată (${next.recoveries - lastLogged.recoveries})`);
      }
      if (next.underruns > lastLogged.underruns) {
        pushAudioEvent('underrun', `Pauză de randare (${next.underruns - lastLogged.underruns})`);
      }
      if (next.error && next.error !== lastLogged.error) pushAudioEvent('error', next.error);
      lastLogged.recoveries = next.recoveries;
      lastLogged.underruns = next.underruns;
      lastLogged.error = next.error;
    };
    const recover = () => {
      if (closed) return;
      if (playing() && (context.state === 'suspended' || context.state === 'interrupted') && !recovering) {
        // Do not use ensureAudio: it also restores master volume, including after a panic stop.
        recovering = context.resume().then(() => {
          if (context.state === 'running') { mainRecoveries++; mainError = null; }
        }).catch(() => { mainError = 'Browserul a suspendat sunetul. Apasă Play pentru a permite reluarea.'; })
          .finally(() => { recovering = null; snapshot(); });
      }
      if (context.state === 'running' && playing() && repairOutputs && !repairing &&
        performance.now() >= retryAt && (
          desiredSpeakersRef?.current.some(({ deviceId }) => !outputsRef.current.has(deviceId)) ||
          [...outputsRef.current.values()].some((output) => output.playback.failed && performance.now() >= (output.retryAt || 0)))) {
        retryAt = performance.now() + 5000;
        repairing = Promise.resolve(repairOutputs()).finally(() => { repairing = null; snapshot(); });
      }
      if (context.state === 'running') outputsRef.current.forEach(({ playback }) => {
        if (!playback?.started || playback.failed) return;
        if (playback.needsRecovery?.() ?? playback.audio?.paused) playback.resume?.().catch(() => {});
      });
      snapshot();
    };
    const visible = () => { if (!document.hidden) recover(); };
    context.addEventListener('statechange', recover);
    document.addEventListener('visibilitychange', visible);
    document.addEventListener('pointerdown', recover, true);
    document.addEventListener('keydown', recover, true);
    const timer = setInterval(recover, 1000);
    snapshot();
    return () => {
      closed = true;
      clearInterval(timer);
      context.removeEventListener('statechange', recover);
      document.removeEventListener('visibilitychange', visible);
      document.removeEventListener('pointerdown', recover, true);
      document.removeEventListener('keydown', recover, true);
    };
  }, [outputsRef, ctxRef, decksRef, movieRef, engineContext, repairOutputs, stabilityMode, desiredSpeakersRef]);
  return protection;
}