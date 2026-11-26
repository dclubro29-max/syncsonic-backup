import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';
import { resumeAudioContext } from '@/components/audio/resumeAudioContext';

/** Render each secondary speaker on its own hardware clock, without a media player. */
export function createSpeakerContextRoute(mixer, input, deviceId) {
  const Context = window.AudioContext || window.webkitAudioContext;
  const sinkId = deviceId === SYSTEM_DEFAULT_ID ? '' : deviceId;
  const context = new Context({ latencyHint: 0.2, sinkId });
  const destination = mixer.createMediaStreamDestination();
  const source = context.createMediaStreamSource(destination.stream);
  const gate = context.createGain();
  let closed = false, muted = false;
  gate.gain.value = 0; // Never leak this stream to the system default while selecting its sink.
  input.connect(destination);
  source.connect(gate);
  gate.connect(context.destination);
  return {
    context,
    async start() {
      if (context.sinkId !== sinkId) await context.setSinkId(sinkId);
      if (closed) return;
      await resumeAudioContext(context);
      if (!closed) gate.gain.setValueAtTime(muted ? 0 : 1, context.currentTime);
    },
    setMuted(value) {
      muted = !!value;
      if (!closed) gate.gain.setValueAtTime(muted ? 0 : 1, context.currentTime);
    },
    close() {
      if (closed) return;
      closed = true;
      input.disconnect(destination);
      source.disconnect();
      gate.disconnect();
      destination.stream.getTracks().forEach((track) => track.stop());
      destination.disconnect();
      context.close().catch(() => {});
    },
  };
}