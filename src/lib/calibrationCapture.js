import detectorUrl from '@/components/audio/calibrationDetector.worklet.js?url&no-inline';
import { openCalibrationMicrophone } from '@/lib/calibrationMicrophone';
import { playBeep } from '@/lib/testTone';

const modules = new WeakMap();

export async function createCalibrationCapture(ctx, { microphoneId, signal } = {}) {
  if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') {
    throw new Error('Alinierea automată necesită un browser cu AudioWorklet. Folosește Chrome/Edge actualizat sau calibrarea manuală.');
  }
  if (!modules.has(ctx)) modules.set(ctx, ctx.audioWorklet.addModule(detectorUrl));
  await modules.get(ctx);
  signal?.throwIfAborted();
  const stream = await openCalibrationMicrophone(microphoneId);
  let source, detector, silent, active = true;
  const close = () => {
    active = false;
    source?.disconnect();
    detector?.port.postMessage({ type: 'cancel' });
    detector?.disconnect();
    silent?.disconnect();
    stream.getTracks().forEach((track) => track.stop());
  };
  let initialized = false;
  try {
    signal?.throwIfAborted();
    source = ctx.createMediaStreamSource(stream);
    detector = new AudioWorkletNode(ctx, 'speaker-calibration-detector');
    silent = ctx.createGain();
    silent.gain.value = 0; // The microphone is NEVER monitored through the speakers.
    source.connect(detector);
    detector.connect(silent);
    silent.connect(ctx.destination);
    const listen = (input, frequency) => new Promise((resolve, reject) => {
      if (!active || signal?.aborted) { reject(new DOMException('Calibrare anulată.', 'AbortError')); return; }
      const id = Math.random().toString(36).slice(2);
      const at = ctx.currentTime + 0.35;
      const finish = (error, value) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        detector.port.onmessage = null;
        detector.port.postMessage({ type: 'cancel' });
        if (error) reject(error); else resolve(value);
      };
      const abort = () => finish(new DOMException('Calibrare anulată.', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('Măsurătoarea a expirat. Păstrează pagina activă și verifică microfonul.')), 2600);
      signal?.addEventListener('abort', abort, { once: true });
      detector.port.onmessage = ({ data }) => {
        if (data.id !== id) return;
        if (ctx.state !== 'running' || stream.getAudioTracks().some((track) => track.readyState !== 'live' || track.muted)) {
          finish(new Error('Microfonul sau redarea audio s-a oprit în timpul măsurătorii.')); return;
        }
        finish(null, Number.isFinite(data.arrival) && data.arrival >= 0 && data.arrival <= 1400 ? data.arrival : null);
      };
      detector.port.postMessage({ id, at, frequency });
      playBeep(ctx, input, 85, frequency, at, signal);
    });
    initialized = true;
    return { listen, close };
  } finally {
    if (!initialized) close();
  }
}