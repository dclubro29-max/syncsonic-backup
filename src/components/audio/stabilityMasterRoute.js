/** Retire all master processing and auxiliary sinks, retaining the output clock. */
export default function createStabilityMasterRoute(ctx, nodes, getRecord, getCue) {
  const { master, subCut, limOut, bypassGain, post, masterAnalyser, cueBus } = nodes;
  const headroom = ctx.createGain();
  headroom.gain.value = 0.25; // Four full-scale decks remain below clipping without a limiter.
  let active = false;
  return (enabled) => {
    if (active === enabled) return;
    const record = getRecord(), cue = getCue();
    if (enabled) {
      master.disconnect(subCut);
      limOut.disconnect(post);
      bypassGain.disconnect(post);
      post.disconnect(masterAnalyser);
      if (record) post.disconnect(record);
      if (cue) cueBus.disconnect(cue);
      master.connect(headroom);
      headroom.connect(post);
    } else {
      master.disconnect(headroom);
      headroom.disconnect(post);
      master.connect(subCut);
      limOut.connect(post);
      bypassGain.connect(post);
      post.connect(masterAnalyser);
      if (record) post.connect(record);
      if (cue) cueBus.connect(cue);
    }
    active = enabled;
  };
}