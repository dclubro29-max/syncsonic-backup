/* global AudioWorkletProcessor, registerProcessor, sampleRate, currentFrame */
/**
 * Detectează semnalele de test pe ceasul audio al telefonului.
 * Nu inventează momente: fiecare onset este raportat doar după o secvență
 * susținută de ton în bandă îngustă, deasupra zgomotului camerei.
 */
class CalibrationDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.job = null;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'cancel') { this.job = null; return; }
      this.job = { ...data, count: 0, real: 0, imag: 0, energy: 0,
        floor: 0, hits: 0, onset: null };
      this.job.startFrame = null;
      if (data.mode === 'scan') {
        this.job.onsets = [];
        this.job.levels = [];
        this.job.lastOnset = -1;
        this.job.frequency = data.frequency || 900;
        this.job.minHits = data.minHits || 3;
        this.job.debounce = data.debounce || 0.32;
      }
      if (data.mode === 'probe') {
        this.job.frames = 0;
        this.job.rmsSum = 0;
        this.job.peak = 0;
      }
    };
  }

  process(inputs) {
    const samples = inputs[0]?.[0];
    const job = this.job;
    if (!samples || !job) return true;

    if (job.mode === 'probe') {
      if (job.startFrame == null) job.startFrame = currentFrame;
      const endFrame = job.startFrame + Math.ceil(job.duration * sampleRate);
      for (let i = 0; i < samples.length; i++) {
        const frame = currentFrame + i;
        if (frame >= endFrame) {
          const frames = Math.max(0, job.frames);
          this.port.postMessage({
            type: 'probe-result',
            id: job.id,
            frames,
            rms: frames ? Math.sqrt(job.rmsSum / frames) : 0,
            peak: job.peak,
            sample_rate: sampleRate,
          });
          this.job = null;
          break;
        }
        const sample = samples[i];
        job.rmsSum += sample * sample;
        const absolute = sample < 0 ? -sample : sample;
        if (absolute > job.peak) job.peak = absolute;
        job.frames++;
      }
      return true;
    }

    if (job.mode === 'scan') {
      if (job.startFrame == null) job.startFrame = currentFrame;
      const endFrame = job.startFrame + Math.ceil(job.duration * sampleRate);
      for (let i = 0; i < samples.length; i++) {
        const frame = currentFrame + i;
        if (frame >= endFrame) {
          this.port.postMessage({ type: 'scan-result', id: job.id, onsets: job.onsets,
            levels: job.levels, floor: job.floor, sample_rate: sampleRate });
          this.job = null;
          break;
        }
        const sample = samples[i];
        const phase = 2 * Math.PI * job.frequency * frame / sampleRate;
        job.real += sample * Math.cos(phase);
        job.imag += sample * Math.sin(phase);
        job.energy += sample * sample;
        if (++job.count < 256) continue;
        const tone = 2 * Math.hypot(job.real, job.imag) / job.count;
        const rms = Math.sqrt(job.energy / job.count);
        const at = (frame - job.count + 1 - job.startFrame) / sampleRate;
        job.count = job.real = job.imag = job.energy = 0;
        if (at < 0) continue;
        // Prima jumătate de secundă este zgomotul camerei, înainte de orice semnal.
        if (at < 0.5) job.floor = Math.max(job.floor, tone);
        const threshold = Math.max(0.0006, job.floor * 2.8);
        if (tone > threshold && tone > rms * 0.82) {
          if (!job.hits) job.onset = at;
          job.hits++;
        } else {
          job.hits = 0;
          job.onset = null;
        }
        if (job.hits >= job.minHits
          && (job.lastOnset < 0 || job.onset - job.lastOnset > job.debounce)) {
          job.onsets.push(job.onset);
          job.levels.push(tone / Math.max(0.0006, job.floor));
          job.lastOnset = job.onset;
          job.hits = 0;
          job.onset = null;
        }
        if (at >= job.duration) {
          this.port.postMessage({ type: 'scan-result', id: job.id, onsets: job.onsets,
            levels: job.levels, floor: job.floor, sample_rate: sampleRate });
          this.job = null;
          break;
        }
      }
      return true;
    }

    return true;
  }
}
registerProcessor('speaker-calibration-detector', CalibrationDetector);