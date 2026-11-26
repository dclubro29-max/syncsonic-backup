import { resetAutoPerformance } from '@/lib/autoPerformanceGraph';
import { idleConvolver } from '@/components/audio/convolverIdle';

/** Source -> deck volume -> crossfader. No FFT, tone, sends or effects sinks. */
export default function setStabilityDeckRoute(node, destination, cueBus, enabled) {
  if (!!node.stabilityBypass === enabled) return;
  if (enabled) {
    resetAutoPerformance(node.performance, node.src.context);
    [node.echoLifecycle, node.performance.echoLifecycle, node.performance.roll.lifecycle].forEach((effect) => effect.idle());
    [node.revSend, node.performance.reverbSend].forEach((send) => {
      clearTimeout(send.idleTimer);
      idleConvolver(send);
    });
    node.src.disconnect(node.trim);
    node.filter.disconnect(node.gain);
    node.filter.disconnect(node.monitorSend);
    node.gain.disconnect(node.dry);
    node.gain.disconnect(node.revSend);
    node.fxOut.disconnect(node.performance.input);
    node.performance.output.disconnect(node.analyser);
    node.analyser.disconnect(destination);
    node.monitorSend.disconnect(cueBus);
    node.src.connect(node.gain);
    node.gain.connect(destination);
    node.audio.preservesPitch = false;
  } else {
    node.src.disconnect(node.gain);
    node.gain.disconnect(destination);
    node.src.connect(node.trim);
    node.filter.connect(node.gain);
    node.filter.connect(node.monitorSend);
    node.gain.connect(node.dry);
    node.gain.connect(node.revSend);
    node.fxOut.connect(node.performance.input);
    node.performance.output.connect(node.analyser);
    node.analyser.connect(destination);
    node.monitorSend.connect(cueBus);
  }
  node.stabilityBypass = enabled;
}