/**
 * Loop-urile deck-ului se sprijină pe loopStart/loopEnd native ale elementului
 * audio, deci sunt la fel de precise ca redarea, fără cronometre.
 */
export function applyLoop(node, loop, repeat, duration) {
  const a = node.audio;
  if (loop) {
    a.loopStart = Math.max(0, loop.start);
    a.loopEnd = loop.end > loop.start ? loop.end : duration || 0;
    a.loop = true;
  } else if (repeat) {
    a.loopStart = 0;
    a.loopEnd = duration && isFinite(duration) ? duration : 0;
    a.loop = true;
  } else {
    a.loop = false;
    a.loopStart = 0;
    a.loopEnd = 0;
  }
}