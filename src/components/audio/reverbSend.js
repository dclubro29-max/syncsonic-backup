import { holdAudioParameter } from '@/lib/autoDjAudio';
import { idleConvolver, wakeConvolver } from '@/components/audio/convolverIdle';

/** Stop feeding unused convolvers without cutting their audible fade or tail. */
export function scheduleReverbSend(send, context, segments) {
  if (!send || !context || context.state === 'closed') return;
  const now = context.currentTime;
  let end = now;
  segments.forEach(({ over = 0.05, after = 0 }) => {
    end = Math.max(end, now + Math.max(0, after)) + Math.max(0.02, over);
  });
  const active = segments.some(({ to }) => to > 0);
  const final = segments[segments.length - 1]?.to ?? 0;
  holdAudioParameter(send.gain, now);
  if (active) {
    wakeConvolver(send);
    send.gain.setTargetAtTime(1, now, 0.005);
  }
  if (final <= 0) {
    send.gain.setTargetAtTime(0, end, 0.01);
    // Convoluția se oprește abia după ce coada s-a stins, ca firul audio să nu
    // mai calculeze niciun reverb cât timp nu se aude nimic din el.
    clearTimeout(send.idleTimer);
    send.idleTimer = setTimeout(() => idleConvolver(send), Math.max(0, (end - now) * 1000) + 80);
  } else {
    clearTimeout(send.idleTimer);
  }
}