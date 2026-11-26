import detectorUrl from '@/components/audio/calibrationDetector.worklet.js?url&no-inline';
import { openCalibrationMicrophone } from '@/lib/calibrationMicrophone';

/**
 * Microfonul telefonului, folosit doar cât ține proba de calibrare.
 * Nu redă nimic și nu atinge playerul gazdei.
 */
export async function createPhoneCapture() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('Browserul telefonului nu poate deschide microfonul pentru calibrare.');
  const ctx = new Ctx({ latencyHint: 'interactive' });
  await ctx.resume();
  if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') {
    await ctx.close().catch(() => {});
    throw new Error('Calibrarea cu telefonul are nevoie de Chrome, Edge sau Safari actualizat.');
  }
  await ctx.audioWorklet.addModule(detectorUrl);
  const stream = await openCalibrationMicrophone();
  const source = ctx.createMediaStreamSource(stream);
  const detector = new AudioWorkletNode(ctx, 'speaker-calibration-detector');
  const silent = ctx.createGain();
  silent.gain.value = 0;
  source.connect(detector);
  detector.connect(silent);
  silent.connect(ctx.destination);

  let closed = false;
  let pending = null;

  const failPending = (error) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    const reject = pending.reject;
    pending = null;
    detector.port.onmessage = null;
    reject(error);
  };

  const close = () => {
    if (closed) return;
    closed = true;
    failPending(new DOMException('Calibrare închisă.', 'AbortError'));
    detector.port.onmessage = null;
    detector.port.postMessage({ type: 'cancel' });
    source.disconnect();
    detector.disconnect();
    silent.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    ctx.close().catch(() => {});
  };

  const run = ({ mode, duration, frequency = 900, onStart }) => new Promise((resolve, reject) => {
    if (closed) { reject(new Error('Microfonul a fost închis.')); return; }
    if (pending) { reject(new Error('O măsurătoare este deja în curs.')); return; }
    if (ctx.state !== 'running') { reject(new Error('Microfonul s-a oprit. Apasă din nou „Începe”.')); return; }
    const id = Math.random().toString(36).slice(2);
    const expected = mode === 'probe' ? 'probe-result' : 'scan-result';
    const timer = setTimeout(() => {
      pending = null;
      detector.port.onmessage = null;
      detector.port.postMessage({ type: 'cancel' });
      reject(new Error(mode === 'probe'
        ? 'Microfonul nu a trimis probe. Verifică permisiunea și încearcă din nou.'
        : 'Măsurătoarea a expirat. Verifică microfonul și apropierea de boxe.'));
    }, duration * 1000 + 4000);
    pending = { timer, reject };
    detector.port.onmessage = ({ data }) => {
      if (data.type !== expected || data.id !== id) return;
      clearTimeout(timer);
      pending = null;
      detector.port.onmessage = null;
      if (stream.getAudioTracks().some((track) => track.readyState !== 'live')) {
        reject(new Error('Microfonul s-a oprit în timpul măsurătorii. Redeschide sesiunea.'));
        return;
      }
      resolve(data);
    };
    detector.port.postMessage({ type: mode, id, duration, frequency });
    onStart?.();
  });

  const check = (duration = 0.4) => run({ mode: 'probe', duration }).then((result) => {
    if (!result.frames) throw new Error('Microfonul este deschis, dar nu trimite probe. Verifică permisiunea din browser.');
    return result;
  });

  const scan = ({ duration, frequency = 900, onStart } = {}) => run({
    mode: 'scan', duration, frequency, onStart,
  });

  return { ctx, scan, check, close, sampleRate: ctx.sampleRate };
}