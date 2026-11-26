const STALL_MS = 3500;

/** Legacy playback: a live-stream timestamp alone must never trigger a destructive reset. */
export function manageSpeakerMedia(audio, stream, playback, context) {
  let closed = false, pending = null, retryAt = 0;
  const markProgress = () => { playback.stats.error = null; };
  const needsRecovery = () => {
    if (closed || !playback.started || playback.failed || pending || context.state !== 'running') return false;
    const broken = !!audio.error || audio.ended || audio.paused;
    if (broken && !playback.stats.error) {
      playback.stats.transportGaps = (playback.stats.transportGaps || 0) + 1;
      playback.stats.error = 'Fluxul unei boxe s-a blocat; încerc reluarea fără a opri celelalte ieșiri.';
    }
    return broken;
  };
  const resume = () => {
    if (pending) return pending;
    if (!needsRecovery() || performance.now() < retryAt) return Promise.resolve();
    const rebuild = !!audio.error || audio.ended;
    if (rebuild) { audio.srcObject = null; audio.srcObject = stream; }
    retryAt = performance.now() + STALL_MS;
    let timer;
    pending = Promise.race([
      audio.play(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Boxa nu a reluat redarea. Verifică legătura audio și apasă Play.')), 5000); }),
    ]).then(() => {
      if (closed) return;
      markProgress();
      playback.stats.recoveries++;
      playback.stats.error = null;
    }).catch((error) => {
      if (!closed) playback.stats.error = error.message || 'Boxa nu a putut relua redarea.';
      throw error;
    }).finally(() => { clearTimeout(timer); pending = null; });
    return pending;
  };
  return { markProgress, needsRecovery, resume, close: () => { closed = true; } };
}