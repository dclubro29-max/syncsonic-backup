const average = (rows, key) => rows.reduce((sum, row) => sum + (row[key] ?? row.energy), 0) / rows.length;
/** Mid-band density is an energy proxy, NOT voice or stem recognition. */
export function mixZone(deck, start, end) {
  const rows = deck?.structure?.bars?.filter((row) => row.at >= start && row.at < end) || [];
  if (!rows.length) return null;
  const energy = average(rows, 'energy'), mid = average(rows, 'mid');
  return { energy, mid, density: Math.min(1, Math.pow(10, (mid - energy) / 10)),
    rising: rows[rows.length - 1].energy > rows[0].energy + 1.5 };
}
export function entryCue(deck) {
  const offset = deck?.beatOffset || 0;
  if (!deck?.bpm) return 0;
  // Only remove silent lead-in; never jump past a verse to manufacture a mix.
  const first = deck.structure?.bars?.find((row) => row.at < offset + 8 * 240 / deck.bpm && row.energy > -48);
  return first?.at ?? offset;
}
export function protectedMoment(deck, source) {
  return deck?.structure?.events?.some((event) => (event.confidence ?? 0) >= 0.7 &&
    source >= event.buildAt && source < event.releaseAt) || false;
}
export function musicalExit(deck, duration, targetBars) {
  const bar = 240 / deck.bpm, offset = deck.beatOffset || 0;
  const rows = deck.structure?.bars || [];
  const natural = offset + Math.floor((duration - offset) / bar) * bar;
  if (rows.length < 16 || duration < 16 * bar) return duration;
  const sorted = rows.map((row) => row.energy).sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length * 0.55)];
  const first = Math.max(32, Math.ceil(targetBars / 8) * 8);
  for (let bars = first; bars <= first + 32; bars += 8) {
    const at = offset + bars * bar;
    if (at >= natural) break;
    const zone = mixZone(deck, at - 8 * bar, at);
    const peak = deck.structure?.events?.some((event) => event.buildAt < at && event.releaseAt > at - 8 * bar);
    if (zone && !peak && !zone.rising && zone.energy <= typical + 0.5 && zone.density < 0.5) return at;
  }
  // No suitable earlier phrase: play through to the natural outro instead of cutting a chorus.
  return Math.min(duration, natural > offset + 16 * bar ? natural : duration);
}