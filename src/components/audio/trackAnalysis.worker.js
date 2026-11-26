import { computePeaks, computeLoudness, detectBpm, detectBeatOffset } from '@/lib/audioAnalysis';
import { analyzeMusicStructure } from '@/lib/musicStructure';
import { rhythmConfidence } from '@/lib/rhythmConfidence';

// Heavy sample scans run away from playback, UI and the transition scheduler.
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    const { id, channels, sampleRate, bpmHint } = data;
    try {
      const buffer = {
        sampleRate, numberOfChannels: channels.length, length: channels[0].length,
        duration: channels[0].length / sampleRate, getChannelData: (i) => channels[i],
      };
      const peaks = computePeaks(buffer);
      // Generated demos carry their source tempo. It wins over the estimator;
      // imported files have no hint and use the analyser.
      const bpm = bpmHint || detectBpm(buffer);
      const beatOffset = bpm ? detectBeatOffset(buffer, bpm) : 0;
      const loudness = computeLoudness(buffer);
      const bpmConfidence = bpmHint ? 1 : rhythmConfidence(buffer, bpm, beatOffset);
      const structure = await analyzeMusicStructure(buffer, bpm, beatOffset);
      self.postMessage({ id, result: { peaks, bpm, beatOffset, loudness, bpmConfidence, structure } }, [peaks.buffer]);
    } catch (error) {
      self.postMessage({ id, error: error.message || 'Analiza audio nu a reușit.' });
    }
  });
};