/** Keep a visible transfer awake, including after the browser releases the lock. */
export function keepTransferAwake() {
  let lock = null, stopped = false, pending = false;
  const acquire = async () => {
    if (stopped || pending || lock || !navigator.wakeLock?.request || document.visibilityState !== 'visible') return;
    pending = true;
    try {
      const next = await navigator.wakeLock.request('screen');
      if (stopped) { await next.release(); return; }
      lock = next;
      next.addEventListener('release', () => { if (lock === next) lock = null; }, { once: true });
    } catch { /* Screen wake lock is optional; file transfer does not depend on it. */ }
    finally { pending = false; }
  };
  document.addEventListener('visibilitychange', acquire);
  void acquire();
  return { release() {
    stopped = true;
    document.removeEventListener('visibilitychange', acquire);
    if (lock) void lock.release().catch(() => {});
    lock = null;
  } };
}

/** A real recovery timer: disconnected may never emit another state-change event. */
export function watchTransferConnection(pc, onFailure) {
  let timer = null, stopped = false;
  const fail = () => { if (!stopped) { stop(); onFailure(); } };
  const changed = () => {
    if (stopped) return;
    if (pc.iceConnectionState === 'failed') { fail(); return; }
    if (pc.iceConnectionState === 'disconnected') {
      if (!timer) timer = setTimeout(fail, 15000);
    } else { clearTimeout(timer); timer = null; }
  };
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    pc.removeEventListener('iceconnectionstatechange', changed);
  };
  pc.addEventListener('iceconnectionstatechange', changed);
  return stop;
}