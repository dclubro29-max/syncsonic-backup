import createSpeakerOutput from '@/components/audio/speakerOutputGraph';
import { createSpeakerPlayback } from '@/components/audio/speakerPlayback';
import closeSpeakerOutput from '@/components/audio/closeSpeakerOutput';
import { isSpeakerPlaybackMuted } from '@/components/audio/playbackEmergencyGate';

export const MAX_AUTO_RETRIES = 4;

/**
 * Serialized endpoint changes: a failed box keeps its own filters/delay and retry budget.
 *
 * Pornirea tuturor ramurilor se face în același pas. Dacă am aștepta fiecare
 * boxă pe rând, a doua ar pierde gestul utilizatorului și ar rămâne mută.
 */
export default async function reconcileSpeakerOutputs({ context, post, speakers, outputs,
  directDeviceId, isCurrent, settings, configure, onChange }) {
  const wanted = new Set(speakers.map(({ deviceId }) => deviceId));
  outputs.forEach((output, id) => {
    if (wanted.has(id)) return;
    closeSpeakerOutput(post, output);
    outputs.delete(id);
  });

  const pending = [];
  for (const speaker of speakers) {
    if (!isCurrent()) return null;
    const { deviceId } = speaker;
    const direct = directDeviceId === deviceId;
    let output = outputs.get(deviceId), repaired = false;
    if (!output) {
      output = createSpeakerOutput(context, post, deviceId, { ...settings(deviceId), direct, deferStart: true });
      outputs.set(deviceId, output);
    } else if (!!output.playback.direct !== direct ||
      (output.playback.failed &&
        (output.retryFailures || 0) < MAX_AUTO_RETRIES &&
        performance.now() >= (output.retryAt || 0))) {
      const recoveries = output.playback.stats.recoveries || 0;
      repaired = output.playback.failed;
      output.playback.close();
      output.playback = createSpeakerPlayback(context, output.volumeGain, deviceId, { direct, deferStart: true });
      output.playback.stats.recoveries = recoveries;
    }
    output.available = speaker.available !== false;
    output.disconnected = !!speaker.disconnected;
    output.repaired = repaired;
    configure(output);
    output.playback.setMuted(isSpeakerPlaybackMuted(context));
    if (!output.playback.started && !output.playback.failed) {
      pending.push({ output, ready: output.playback.start?.() || output.playback.ready });
    }
    onChange();
  }

  if (pending.length) {
    const results = await Promise.allSettled(pending.map(({ ready }) => ready));
    if (!isCurrent()) return null;
    results.forEach((result, index) => {
      const output = pending[index].output;
      if (result.status === 'rejected') {
        output.retryFailures = (output.retryFailures || 0) + 1;
        output.retryAt = performance.now() + Math.min(30000, 5000 * 2 ** (output.retryFailures - 1));
        if (output.retryFailures >= MAX_AUTO_RETRIES) {
          output.retryAt = Infinity;
          output.playback.stats.error = `Boxa nu a răspuns după ${MAX_AUTO_RETRIES} încercări. Verifică legătura sau alege altă ieșire.`;
        }
      } else {
        output.retryAt = 0;
        output.retryFailures = 0;
        if (output.repaired) output.playback.stats.recoveries++;
      }
      output.repaired = false;
    });
    onChange();
  }

  const active = [...outputs.values()].filter(({ playback }) => playback.started && !playback.failed);
  const failed = [...outputs.values()].find(({ playback }) => playback.failed);
  return { count: active.length, error: failed?.playback.stats.error || null };
}