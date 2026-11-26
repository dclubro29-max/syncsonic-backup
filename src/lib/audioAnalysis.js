// Analiză audio reală, făcută local în browser: decodare, formă de undă și estimare BPM.
// Nimic nu părăsește device-ul.

export async function decodeAudioFromUrl(url, ctx, { signal } = {}) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Fișierul audio nu a putut fi citit.");
  const arr = await res.arrayBuffer();
  signal?.throwIfAborted();
  const buffer = await ctx.decodeAudioData(arr);
  signal?.throwIfAborted();
  return buffer;
}

/**
 * Vârfuri pentru desenarea formei de undă. Reale, calculate din eșantioane.
 * Întoarce un Float32Array de valori 0..1 (una per coloană desenată).
 */
export function computePeaks(buffer, buckets = 1000) {
  const ch = buffer.getChannelData(0);
  const ch2 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const out = new Float32Array(buckets);
  const step = Math.max(1, Math.floor(ch.length / buckets));
  for (let b = 0; b < buckets; b++) {
    const start = b * step;
    const end = Math.min(ch.length, start + step);
    let max = 0;
    for (let i = start; i < end; i++) {
      const a = Math.abs(ch[i]);
      const v = ch2 ? Math.max(a, Math.abs(ch2[i])) : a;
      if (v > max) max = v;
    }
    out[b] = max > 1 ? 1 : max;
  }
  return out;
}

/**
 * Nivelul mediu (RMS) al piesei, în dBFS.
 * Folosit pentru nivelarea automată: piesele masterizate tare și cele slabe
 * ajung la același nivel perceput, deci tranzițiile nu mai sar în volum.
 */
export function computeLoudness(buffer) {
  let sum = 0;
  let n = 0;
  const step = Math.max(1, Math.floor(buffer.length / 2000000));
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += step) {
      sum += data[i] * data[i];
      n++;
    }
  }
  if (!n) return null;
  const rms = Math.sqrt(sum / n);
  return rms > 0 ? 20 * Math.log10(rms) : null;
}

/**
 * Estimare de tempo prin autocorelația creșterilor de energie.
 * Rezultatul este o estimare — poate fi corectat manual din interfață.
 */
export function detectBpm(buffer, maxSeconds = 90) {
  const sr = buffer.sampleRate;
  const total = Math.min(buffer.length, Math.floor(sr * maxSeconds));
  const rate = 110; // câte valori de energie pe secundă
  const hop = Math.max(1, Math.round(sr / rate));
  const frames = Math.floor(total / hop);
  if (frames < 400) return null;

  const ch = buffer.getChannelData(0);
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    let n = 0;
    const s = f * hop;
    for (let i = s; i < s + hop; i += 2) {
      sum += ch[i] * ch[i];
      n++;
    }
    env[f] = n ? Math.sqrt(sum / n) : 0;
  }

  const onset = new Float32Array(frames);
  for (let i = 1; i < frames; i++) {
    const d = env[i] - env[i - 1];
    onset[i] = d > 0 ? d : 0;
  }

  const minLag = Math.round((60 / 190) * rate);
  // Search a full 4-beat bar, not just 1.76 beats. The old ceiling locked onto
  // a 1.5-beat syncopation in the demo (124 × 2/3 = 82.6 BPM) because the real
  // 4-beat period was outside the window. Folding the bar period back into the
  // 80–180 range gives the source tempo.
  const maxLag = Math.round((60 / 70) * rate * 4);
  let bestLag = -1;
  let best = 0;
  const correlation = new Map();
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < frames; i++) s += onset[i] * onset[i + lag];
    s /= frames - lag;
    correlation.set(lag, s);
    if (lag >= minLag && lag <= maxLag && s > best) {
      best = s;
      bestLag = lag;
    }
  }
  if (bestLag <= 0 || best <= 0) return null;

  // Sub-frame interpolation prevents integer-lag BPM errors accumulating across the song.
  const left = correlation.get(bestLag - 1) || 0;
  const right = correlation.get(bestLag + 1) || 0;
  const denominator = left - 2 * best + right;
  const fraction = denominator ? Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / denominator)) : 0;
  let bpm = (60 * sr / hop) / (bestLag + fraction);
  while (bpm < 80) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}

/**
 * Faza grid-ului de ritm: găsește poziția primei bătăi (offset în secunde) care
 * aliniază cel mai bine un tren de impulsuri la BPM-ul dat, peste creșterile de energie.
 * Rezultatul este o estimare — se poate corecta fin din interfață.
 */
export function detectBeatOffset(buffer, bpm, maxSeconds = 90) {
  if (!bpm || bpm <= 0) return 0;
  const sr = buffer.sampleRate;
  const total = Math.min(buffer.length, Math.floor(sr * maxSeconds));
  const rate = 110; // valori de energie pe secundă
  const hop = Math.max(1, Math.round(sr / rate));
  const frames = Math.floor(total / hop);
  if (frames < 400) return 0;

  const ch = buffer.getChannelData(0);
  const onset = new Float32Array(frames);
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    let n = 0;
    const s = f * hop;
    for (let i = s; i < s + hop; i += 2) {
      sum += ch[i] * ch[i];
      n++;
    }
    const env = n ? Math.sqrt(sum / n) : 0;
    const d = env - prev;
    onset[f] = d > 0 ? d : 0;
    prev = env;
  }

  const beatFrames = (60 / bpm) * sr / hop;
  if (beatFrames < 2) return 0;
  const halfSteps = Math.max(1, Math.round(beatFrames * 2));
  let bestPhase = 0;
  let best = -1;
  for (let p = 0; p < halfSteps; p++) {
    const phase = p / 2;
    let s = 0;
    for (let f = phase; f < frames; f += beatFrames) {
      const idx = Math.round(f);
      if (idx < frames) s += onset[idx];
    }
    if (s > best) {
      best = s;
      bestPhase = phase;
    }
  }
  return (bestPhase * hop) / sr;
}

/**
 * Răspuns la impuls pentru reverb, construit local: zgomot colorat care se
 * închide treptat în înalte (ca aerul dintr-o sală), câteva reflexii timpurii
 * diferite pe canale și o coadă lungă, decorată stereo. Sună ca un spațiu real,
 * fără fișiere externe.
 */
export function makeImpulse(ctx, seconds = 2.8, decay = 2.5) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  const early = [
    [[0.011, 0.5], [0.024, 0.36], [0.041, 0.25], [0.068, 0.18]],
    [[0.014, 0.46], [0.029, 0.34], [0.047, 0.24], [0.073, 0.17]],
  ];
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const white = Math.random() * 2 - 1;
      // Filtrul unipolar se închide cu timpul: coada devine caldă, nu șuierătoare.
      lp += (white - lp) * (0.62 - 0.4 * t);
      d[i] = lp * Math.pow(1 - t, decay) * (1 - 0.4 * t);
    }
    early[c].forEach(([delay, gain]) => {
      const at = Math.floor(delay * rate);
      if (at >= len) return;
      const width = Math.max(2, Math.floor(rate * 0.004));
      for (let i = 0; i < width && at + i < len; i++) {
        d[at + i] += gain * (1 - i / width) * (c ? -1 : 1);
      }
    });
  }
  return buf;
}

export function formatTime(t) {
  if (!isFinite(t) || isNaN(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}