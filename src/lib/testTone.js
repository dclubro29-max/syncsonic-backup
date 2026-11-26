/**
 * Semnale locale pentru identificarea, testarea și alinierea ieșirilor.
 * Nivelul este controlat din interfață; semnalul intră în aceeași ramură
 * audibilă ca muzica, imediat după filtrele de bandă.
 */
export function playBeep(ctx, destNode, ms = 350, frequency = 900, at = null, signal = null, { level = 0.22 } = {}) {
  if (!destNode || signal?.aborted) return null;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(destNode);
  const t0 = at != null ? at : ctx.currentTime;
  const dur = Math.max(0.04, ms / 1000);
  const peak = Math.max(0.02, Math.min(0.8, level));
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.setValueAtTime(peak, t0 + Math.max(0.02, dur - 0.02));
  gain.gain.linearRampToValueAtTime(0, t0 + dur);
  const cancel = () => osc.stop();
  osc.onended = () => {
    signal?.removeEventListener('abort', cancel);
    osc.disconnect();
    gain.disconnect();
  };
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
  signal?.addEventListener('abort', cancel, { once: true });
  return t0;
}