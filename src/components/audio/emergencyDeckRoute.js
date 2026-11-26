/** A separate dry path, not zero-valued FX in a still-rendering effects graph. */
export default function setEmergencyDeckRoute(node, enabled) {
  if (!!node.emergencyGain === enabled) return;
  if (enabled) {
    const gain = node.src.context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, node.gain.gain.value));
    node.src.disconnect(node.trim);
    node.performance.output.disconnect(node.analyser);
    node.src.connect(gain);
    gain.connect(node.analyser);
    node.emergencyTempo = { rate: node.audio.playbackRate, source: node.audio.getAttribute('src') };
    node.audio.playbackRate = 1;
    node.emergencyGain = gain;
  } else {
    node.src.disconnect(node.emergencyGain);
    node.emergencyGain.disconnect();
    node.emergencyGain = null;
    if (node.audio.getAttribute('src') === node.emergencyTempo?.source) node.audio.playbackRate = node.emergencyTempo.rate;
    node.emergencyTempo = null;
    node.src.connect(node.trim);
    node.performance.output.connect(node.analyser);
  }
}