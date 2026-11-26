/** The primary speaker stays entirely inside the mixer graph: no media-stream hop. */
export function createDirectSpeakerPlayback(context, input) {
  const gate = context.createGain();
  // Rampe scurte la pornire și la mutare, ca reconectarea să nu pocnească.
  gate.gain.value = 0;
  gate.gain.setValueAtTime(0, context.currentTime);
  gate.gain.linearRampToValueAtTime(1, context.currentTime + 0.35);
  let closed = false;
  input.connect(gate);
  gate.connect(context.destination);
  const playback = {
    direct: true,
    buffered: false,
    safetyMs: 0,
    stats: { recoveries: 0, error: null },
    failed: false,
    started: true,
    startedAt: performance.now(),
    isActive: () => !closed && context.state === 'running',
    needsRecovery: () => false, // The mixer watchdog owns this shared context.
    resume: () => Promise.resolve(),
    setMuted(value) {
      const now = context.currentTime;
      gate.gain.cancelScheduledValues(now);
      gate.gain.setValueAtTime(gate.gain.value, now);
      gate.gain.linearRampToValueAtTime(value ? 0 : 1, now + (value ? 0.05 : 0.18));
    },
    close() {
      if (closed) return;
      closed = true;
      playback.started = false;
      input.disconnect(gate);
      gate.disconnect();
    },
  };
  playback.ready = Promise.resolve();
  return playback;
}