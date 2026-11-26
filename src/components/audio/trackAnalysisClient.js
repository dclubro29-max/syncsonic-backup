import TrackAnalysisWorker from '@/components/audio/trackAnalysis.worker.js?worker';

let worker = null;
let sequence = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new TrackAnalysisWorker();
  worker.onmessage = ({ data }) => {
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id);
    if (data.error) job.reject(new Error(data.error));
    else job.resolve(data.result);
  };
  worker.onerror = () => {
    pending.forEach((job) => job.reject(new Error('Analiza audio nu a reușit.')));
    pending.clear();
    worker.terminate();
    worker = null;
  };
  return worker;
}

export function cancelTrackAnalysis() {
  worker?.terminate();
  worker = null;
  pending.forEach((job) => job.reject(new DOMException('Analiza audio este suspendată.', 'AbortError')));
  pending.clear();
}

export function analyzeBufferOffThread(buffer, bpmHint = null) {
  return new Promise((resolve, reject) => {
    const current = getWorker();
    // Analysis buffers are decoded separately and never used for playback, so the
    // samples are transferred instead of copied: a full copy of a long track is a
    // large allocation that stalls the audio thread while the speakers are playing.
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    current.postMessage(
      { id, channels, sampleRate: buffer.sampleRate, bpmHint },
      channels.map((channel) => channel.buffer),
    );
  });
}