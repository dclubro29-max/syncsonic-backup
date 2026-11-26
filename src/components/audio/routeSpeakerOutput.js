/**
 * Un singur punct care decide ce intră în ramura unei boxe.
 *
 * Normal:     post -> bandGain -> filtre -> delay -> volum -> ieșire
 * Stabilitate: post -> delay -> volum -> ieșire (filtrele de bandă sunt ocolite)
 * Urgență:     post -> volum -> ieșire (filtrele și întârzierea sunt ocolite)
 *
 * Sursa veche este deconectată înainte de a conecta alta, ca aceeași ramură
 * să nu primească niciodată mixul de două ori.
 */
export default function routeSpeakerOutput(post, output, { emergency = false, stability = false } = {}) {
  if (!post || !output) return;
  const desired = emergency ? 'emergency' : stability ? 'stability' : 'normal';
  if (output.route === desired) return;

  [output.bandGain, output.delayNode, output.volumeGain].forEach((node) => {
    try {
      post.disconnect(node);
    } catch (error) {
      /* Already disconnected. */
    }
  });

  if (desired === 'normal') post.connect(output.bandGain);
  else if (desired === 'stability') post.connect(output.delayNode);
  else post.connect(output.volumeGain);

  output.route = desired;
  output.emergencyBypass = desired === 'emergency';
  output.stabilityBypass = desired === 'stability';
}