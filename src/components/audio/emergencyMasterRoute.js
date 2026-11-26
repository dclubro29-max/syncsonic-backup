/** Disconnect the processed master from both its source and its audible destination. */
export default function createEmergencyMasterRoute(ctx, {
  master, subCut, limOut, bypassGain, post, defaultReserve, defaultGain,
}) {
  const clean = ctx.createGain();
  // Four full-scale decks cannot clip the dry sum; no waveshaping or compression.
  clean.gain.value = 0.25;
  let active = false;
  return (enabled) => {
    if (active === enabled) return;
    if (enabled) {
      master.disconnect(subCut);
      limOut.disconnect(post);
      bypassGain.disconnect(post);
      master.connect(clean);
      clean.connect(post);
      post.disconnect(defaultReserve);
      defaultReserve.disconnect(defaultGain);
      post.connect(defaultGain);
    } else {
      master.disconnect(clean);
      clean.disconnect(post);
      master.connect(subCut);
      limOut.connect(post);
      bypassGain.connect(post);
      post.disconnect(defaultGain);
      post.connect(defaultReserve);
      defaultReserve.connect(defaultGain);
    }
    active = enabled;
  };
}