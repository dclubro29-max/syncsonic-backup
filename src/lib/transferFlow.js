const HIGH_WATER = 1024 * 1024;
const LOW_WATER = 256 * 1024;

/** Event-driven backpressure, with close/cancel detection instead of an indefinite wait. */
export function waitForTransferBuffer(channel, isCancelled) {
  if (channel.readyState !== 'open' || isCancelled()) return Promise.reject(new Error('Transfer întrerupt.'));
  if (channel.bufferedAmount < HIGH_WATER) return Promise.resolve();
  return new Promise((resolve, reject) => {
    channel.bufferedAmountLowThreshold = LOW_WATER;
    let timer, settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      channel.removeEventListener('bufferedamountlow', low);
      channel.removeEventListener('close', closed);
      channel.removeEventListener('error', closed);
      error ? reject(error) : resolve();
    };
    const low = () => finish();
    const closed = () => finish(new Error('Conexiunea de transfer s-a închis.'));
    let lastAmount = channel.bufferedAmount, lastDrain = Date.now();
    channel.addEventListener('bufferedamountlow', low, { once: true });
    channel.addEventListener('close', closed, { once: true });
    channel.addEventListener('error', closed, { once: true });
    timer = setInterval(() => {
      const amount = channel.bufferedAmount;
      if (amount < lastAmount) lastDrain = Date.now();
      lastAmount = amount;
      if (isCancelled() || channel.readyState !== 'open') closed();
      else if (amount <= LOW_WATER) low();
      else if (Date.now() - lastDrain > 20000) finish(new Error('Transfer blocat: conexiunea nu mai trimite date. Reia transferul; piesele salvate nu vor fi retrimise.'));
    }, 200);
    if (channel.bufferedAmount <= LOW_WATER) low();
  });
}

/** An acknowledgement means the receiving device has actually saved the file. */
export function sendAndConfirm(channel, message, type, index, isCancelled, timeout = 30000) {
  return new Promise((resolve, reject) => {
    let timer, settled = false;
    const finish = (error, reply) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      channel.removeEventListener('message', receive);
      channel.removeEventListener('close', closed);
      channel.removeEventListener('error', closed);
      error ? reject(error) : resolve(reply);
    };
    const receive = (event) => {
      if (typeof event.data !== 'string') return;
      let reply;
      try { reply = JSON.parse(event.data); }
      catch { finish(new Error('Răspuns de transfer invalid.')); return; }
      if (reply.t === 'error') finish(new Error(reply.message || 'Salvarea piesei a eșuat.'));
      else if (reply.t === type && (index == null || reply.index === index)) finish(null, reply);
    };
    const closed = () => finish(new Error('Transfer întrerupt înainte de confirmarea salvării.'));
    // The bounded bulk-data queue keeps control replies from sitting behind many megabytes.
    const deadline = Date.now() + timeout;
    channel.addEventListener('message', receive);
    channel.addEventListener('close', closed, { once: true });
    channel.addEventListener('error', closed, { once: true });
    timer = setInterval(() => {
      if (isCancelled() || channel.readyState !== 'open') closed();
      else if (Date.now() > deadline) finish(new Error(type === 'ready'
        ? 'Actualizează aplicația pe ambele dispozitive și pornește un cod nou.'
        : 'Dispozitivul nu mai răspunde. Reia transferul; piesele deja salvate vor fi omise.'));
    }, 250);
    if (channel.readyState !== 'open' || isCancelled()) { closed(); return; }
    try { channel.send(JSON.stringify(message)); }
    catch (error) { finish(error); }
  });
}

export function createTransferProgress(onState, phase, total, totalBytes) {
  let bytes = 0, done = 0, previousBytes = 0, previousAt = performance.now(), emittedAt = 0, speed = 0;
  return (byteCount = 0, completed = false, force = false, name = '') => {
    bytes = Math.min(totalBytes, bytes + byteCount);
    if (completed) done++;
    const now = performance.now(), elapsed = now - previousAt;
    if (elapsed >= 250) {
      const sample = Math.max(0, bytes - previousBytes) * 1000 / elapsed;
      speed = speed ? speed * 0.5 + sample * 0.5 : sample;
      previousAt = now; previousBytes = bytes;
    }
    if (!force && now - emittedAt < 250) return;
    emittedAt = now;
    onState({ phase, progress: { done, total, bytes, totalBytes, speed,
      eta: speed > 0 ? Math.ceil(Math.max(0, totalBytes - bytes) / speed) : null, name } });
  };
}