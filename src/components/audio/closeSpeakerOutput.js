/** Release only the removed speaker's branch; never disconnect the whole master bus. */
export default function closeSpeakerOutput(post, output) {
  output.playback.close();
  [output.bandGain, output.delayNode, output.volumeGain].forEach((node) => {
    try {
      post.disconnect(node);
    } catch (error) {
      /* The branch may already be disconnected. */
    }
  });
  [output.bandGain, output.filterA, output.filterB, output.delayNode,
    output.outGain, output.volumeGain].forEach((node) => {
    try {
      node.disconnect();
    } catch (error) {
      /* Already released. */
    }
  });
}