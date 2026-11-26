/** Confidence in a fixed beatgrid, measured locally from repeated energy onsets. */
export function rhythmConfidence(buffer, bpm, offset = 0) {
  if (!bpm) return 0;
  const hop = Math.max(1, Math.round(buffer.sampleRate / 110));
  const frames = Math.floor(Math.min(buffer.length, buffer.sampleRate * 90) / hop);
  if (frames < 400) return 0;
  const channel = buffer.getChannelData(0), onset = new Float32Array(frames);
  const stride = Math.max(1, Math.floor(buffer.sampleRate / 6000));
  let previous = 0, total = 0, onGrid = 0;
  const beat = 60 / bpm;
  for (let f = 0; f < frames; f++) {
    let energy = 0, count = 0;
    for (let s = f * hop; s < Math.min(channel.length, (f + 1) * hop); s += stride) {
      energy += channel[s] * channel[s]; count++;
    }
    const envelope = Math.sqrt(energy / Math.max(1, count));
    const value = Math.max(0, envelope - previous);
    onset[f] = value; previous = envelope; total += value;
    const phase = ((f * hop / buffer.sampleRate - offset) / beat % 1 + 1) % 1;
    if (Math.min(phase, 1 - phase) < 0.16) onGrid += value;
  }
  const lag = beat * buffer.sampleRate / hop, scores = [];
  const window = Math.round(buffer.sampleRate * 20 / hop);
  for (let start = 0; start + lag + 200 < frames; start += window) {
    const end = Math.min(frames - Math.ceil(lag) - 1, start + window);
    let product = 0, aPower = 0, bPower = 0;
    for (let i = start; i < end; i++) {
      const at = i + lag, low = Math.floor(at), fraction = at - low;
      const a = onset[i], b = onset[low] * (1 - fraction) + onset[low + 1] * fraction;
      product += a * b; aPower += a * a; bPower += b * b;
    }
    if (aPower > 1e-8 && bPower > 1e-8) scores.push(product / Math.sqrt(aPower * bPower));
  }
  if (!total || !scores.length) return 0;
  const correlation = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return Math.min(1, Math.max(0, correlation * 0.65 + onGrid / total * 0.35));
}