const START_TIMEOUT_MS = 8000;

/** Start the timeout only when this endpoint gets its turn, not while others are opening. */
export default function bindSpeakerMediaStart(playback, open, { deferStart = false } = {}) {
  let started = false, settled = false, timer, resolveReady, rejectReady;
  playback.ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // A deselection can cancel a queued endpoint before its caller starts awaiting it.
  playback.ready.catch(() => {});
  const finish = (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (error) {
      playback.failed = true;
      playback.stats.error = error.message;
      rejectReady(error);
      playback.close();
    } else resolveReady();
  };
  playback.start = () => {
    if (started || settled) return playback.ready;
    started = true;
    timer = setTimeout(() => finish(new Error('Boxa nu a pornit în 8 secunde. Celelalte ieșiri rămân active.')), START_TIMEOUT_MS);
    Promise.resolve().then(open).then(() => finish(), finish);
    return playback.ready;
  };
  if (!deferStart) playback.start();
  return () => finish(new DOMException('Ieșirea audio a fost închisă.', 'AbortError'));
}