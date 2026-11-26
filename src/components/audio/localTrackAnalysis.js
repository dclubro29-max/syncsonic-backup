import { decodeAudioFromUrl } from '@/lib/audioAnalysis';
import { analyzeBufferOffThread, cancelTrackAnalysis } from '@/components/audio/trackAnalysisClient';

// Only one analysis decoder runs at a time, never on the live output context.
let queue = Promise.resolve();
let paused = false;
let epoch = 0;
let controller = null;
export function setLocalAnalysisPaused(value) {
  paused = value;
  if (paused) {
    epoch++;
    controller?.abort();
    cancelTrackAnalysis();
  }
}

export function analyzeLocalTrack(track, isCurrent = () => true) {
  const cancelled = () => new DOMException('Analiza audio a fost suspendată.', 'AbortError');
  const requestedEpoch = epoch;
  const isCancelled = () => paused || epoch !== requestedEpoch || !isCurrent();
  const job = queue.then(async () => {
    if (isCancelled()) throw cancelled();
    const request = new AbortController();
    controller = request;
    try {
      const decoder = new OfflineAudioContext(2, 1, 22050);
      const buffer = await decodeAudioFromUrl(track.url, decoder, { signal: request.signal });
      if (isCancelled()) throw cancelled();
      const result = await analyzeBufferOffThread(buffer, track.bpmHint || null);
      if (isCancelled()) throw cancelled();
      return result;
    } finally {
      if (controller === request) controller = null;
    }
  });
  queue = job.catch(() => {});
  return job;
}