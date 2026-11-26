const mutedContexts = new WeakSet();

export function isSpeakerPlaybackMuted(context) {
  return mutedContexts.has(context);
}

/** An emergency stop must mute AFTER the reserve, not wait for queued music to drain. */
export function muteSpeakerPlayback(context, outputs, defaultGain) {
  if (!context || context.state === 'closed') return;
  mutedContexts.add(context);
  outputs.forEach(({ playback }) => playback.setMuted?.(true));
  if (defaultGain) {
    defaultGain.gain.cancelScheduledValues(context.currentTime);
    defaultGain.gain.setValueAtTime(0, context.currentTime);
  }
}

export function restoreSpeakerPlayback(context, outputs, defaultGain, fallbackVolume) {
  if (!context || !mutedContexts.has(context)) return;
  mutedContexts.delete(context);
  outputs.forEach(({ playback }) => playback.setMuted?.(false));
  if (defaultGain) {
    defaultGain.gain.cancelScheduledValues(context.currentTime);
    defaultGain.gain.setValueAtTime(outputs.size ? 0 : fallbackVolume, context.currentTime);
  }
}