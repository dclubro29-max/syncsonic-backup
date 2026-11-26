import { playBeep } from "@/lib/testTone";

/**
 * Sincronizare de concert.
 *
 * Din zece în zece secunde, fiecare boxă emite un semnal scurt, aproape
 * inaudibil (16 kHz). Microfonul măsoară când ajunge sunetul de la fiecare
 * ieșire, iar boxele care cântă prea repede primesc o întârziere, ca totul să
 * ajungă la ureche în același moment. Muzica nu se oprește niciodată: semnalul
 * de verificare e prea sus ca să se audă peste ea.
 */

export const PILOT_FREQUENCIES = [
  { id: 1500, label: '1,5 kHz · semnal audibil, recomandat' },
  { id: 16000, label: '16 kHz · compatibilitate variabilă' },
  { id: 18000, label: '18 kHz · compatibilitate variabilă' },
];

export const PILOT_INTERVAL_MS = 10000;

const BEACON_MS = 55;
const LISTEN_MS = 300;
const GAP_MS = 260;
const FLOOR_MS = 200;
const MAX_STEP_MS = 80;
const MAX_LATENCY_MS = 400;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Microfonul stă deschis doar cât ține verificarea, apoi e eliberat imediat. */
async function openMic(ctx, frequency) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const source = ctx.createMediaStreamSource(stream);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = frequency;
  band.Q.value = 6;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(band);
  band.connect(analyser);
  return {
    analyser,
    buf: new Float32Array(analyser.fftSize),
    close() {
      try {
        source.disconnect();
        band.disconnect();
      } catch (e) {
        /* ignore */
      }
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/** Cât de tare e muzica exact pe banda semnalului, ca să nu o confundăm cu el. */
function floorLevel(analyser, buf, ms) {
  return new Promise((resolve) => {
    const deadline = performance.now() + ms;
    let max = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
      if (performance.now() > deadline) {
        resolve(max);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Momentul sosirii semnalului, pe ceasul audio; vârful dă precizia sub cadru. */
function listenPeak(analyser, buf, threshold, deadline) {
  return new Promise((resolve) => {
    const tick = () => {
      const ctx = analyser.context;
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      let idx = 0;
      for (let i = 0; i < buf.length; i++) {
        const a = Math.abs(buf[i]);
        if (a > peak) {
          peak = a;
          idx = i;
        }
      }
      if (peak > threshold) {
        resolve(ctx.currentTime - (buf.length - idx) / ctx.sampleRate);
        return;
      }
      if (ctx.currentTime > deadline) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * O verificare completă: un semnal per boxă, ascultat cu microfonul.
 * Întoarce cât durează drumul până la microfon pentru fiecare ieșire, în ms.
 */
export async function runPilotCheck({ ctx, nodes, frequency, onStep }) {
  const mic = await openMic(ctx, frequency);
  try {
    await wait(120);
    const floor = await floorLevel(mic.analyser, mic.buf, FLOOR_MS);
    const threshold = Math.max(0.01, floor * 3);
    const results = [];

    for (const node of nodes) {
      onStep?.(node.deviceId);
      await wait(GAP_MS);
      const at = playBeep(ctx, node.input, BEACON_MS, frequency);
      const arrival = await listenPeak(mic.analyser, mic.buf, threshold, at + LISTEN_MS / 1000);
      const latency = arrival == null ? null : (arrival - at) * 1000;
      results.push({
        deviceId: node.deviceId,
        latency:
          latency != null && latency >= 0 && latency <= MAX_LATENCY_MS ? latency : null,
      });
      await wait(60);
    }

    return { results, threshold };
  } finally {
    mic.close();
  }
}

/**
 * Corecția unei verificări: boxele care cântă prea repede primesc întârziere,
 * ca toate să ajungă în același moment. Pasul e limitat, ca o citire ratată să
 * nu mute boxele aiurea.
 */
export function planCorrection(results, delays) {
  const valid = results.filter((r) => r.latency != null);
  if (valid.length < 2) return { changes: [], spread: null, heard: valid.length };

  const spread = Math.round(
    Math.max(...valid.map((r) => r.latency)) - Math.min(...valid.map((r) => r.latency))
  );
  const slowest = Math.max(...valid.map((r) => r.latency));

  // Dacă toate întârzierile au crescut mult, cea mai mică revine la zero,
  // ca reglajele să nu urce la infinit de la o verificare la alta.
  const smallest = Math.min(...valid.map((r) => delays[r.deviceId] ?? 0));
  if (smallest > 250) {
    return {
      changes: valid.map((r) => ({
        deviceId: r.deviceId,
        delay: Math.max(0, Math.round((delays[r.deviceId] ?? 0) - smallest)),
      })),
      spread,
      heard: valid.length,
    };
  }

  const changes = valid
    .map((r) => {
      const step = Math.min(slowest - r.latency, MAX_STEP_MS);
      if (step <= 1.5) return null;
      const next = Math.max(0, Math.min(500, Math.round((delays[r.deviceId] ?? 0) + step)));
      return { deviceId: r.deviceId, delay: next };
    })
    .filter(Boolean);

  return { changes, spread, heard: valid.length };
}