/**
 * Beat de test generat în browser, fără fișiere importate.
 *
 * Se randează o singură dată, offline, apoi se redă în buclă printr-un singur
 * BufferSource. Costul pe firul audio este minim, deci testul nu poate provoca
 * singur întreruperile pe care le măsoară.
 */
const buffers = new WeakMap();
const BPM = 120;
const BEATS = 8;

function renderBeat(ctx) {
  const cached = buffers.get(ctx);
  if (cached) return cached;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline) return Promise.reject(new Error('Browserul nu poate genera beat-ul de test.'));
  const beat = 60 / BPM;
  const seconds = beat * BEATS;
  const offline = new Offline(2, Math.ceil(seconds * 44100), 44100);
  const out = offline.createGain();
  out.gain.value = 0.85;
  out.connect(offline.destination);
  const noise = offline.createBuffer(1, Math.ceil(offline.sampleRate * 0.25), offline.sampleRate);
  const noiseData = noise.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

  const kick = (at) => {
    const osc = offline.createOscillator();
    const gain = offline.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, at);
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.95, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + 0.32);
  };
  const snare = (at) => {
    const src = offline.createBufferSource();
    const band = offline.createBiquadFilter();
    const gain = offline.createGain();
    src.buffer = noise;
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 0.8;
    gain.gain.setValueAtTime(0.42, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    src.connect(band).connect(gain).connect(out);
    src.start(at);
    src.stop(at + 0.2);
  };
  const hat = (at) => {
    const src = offline.createBufferSource();
    const high = offline.createBiquadFilter();
    const gain = offline.createGain();
    src.buffer = noise;
    high.type = 'highpass';
    high.frequency.value = 7000;
    gain.gain.setValueAtTime(0.11, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(high).connect(gain).connect(out);
    src.start(at);
    src.stop(at + 0.06);
  };

  for (let i = 0; i < BEATS; i++) {
    const at = i * beat;
    if (i % 4 === 0 || i % 4 === 2) kick(at);
    if (i % 4 === 1 || i % 4 === 3) snare(at);
    hat(at);
    hat(at + beat / 2);
  }

  const promise = offline.startRendering()
    .then((buffer) => { buffers.set(ctx, buffer); return buffer; })
    .catch((error) => { buffers.delete(ctx); throw error; });
  buffers.set(ctx, promise);
  return promise;
}

export async function startBeat(ctx, destination, { level = 0.22 } = {}) {
  const buffer = await renderBeat(ctx);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.loop = true;
  gain.gain.value = level;
  source.connect(gain);
  gain.connect(destination);
  source.start();
  return {
    stop() {
      try { source.stop(); } catch (e) { /* already stopped */ }
      source.disconnect();
      gain.disconnect();
    },
  };
}