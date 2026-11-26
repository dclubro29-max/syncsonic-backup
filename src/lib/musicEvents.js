const mean = (rows, from, count, key) => {
  const end = Math.min(rows.length, from + count);
  let sum = 0, n = 0;
  for (let i = Math.max(0, from); i < end; i++) { sum += rows[i][key]; n++; }
  return n ? sum / n : -100;
};

/** Locate sustained changes at their actual onset, not the centre of a long averaging window. */
export function selectMusicEvents(beats, bars, beat, offset) {
  if (beats.length < 32) return [];
  const energies = bars.map((row) => row.energy).sort((a, b) => a - b);
  const quiet = energies[Math.floor(energies.length * 0.15)] ?? -40;
  const energetic = energies[Math.floor(energies.length * 0.6)] ?? -20;
  const spread = Math.max(3, (energies[energies.length - 1] ?? -10) - quiet);
  // Cât de tare iese banda vocii față de total, raportat la piesa însăși: pragul
  // rămâne corect și la piese masterizate tare, și la cele slabe.
  const relMedian = (key) => {
    const values = bars.map((row) => (Number.isFinite(row[key]) ? row[key] - row.energy : -99))
      .filter((value) => value > -90).sort((a, b) => a - b);
    return values.length ? values[Math.floor(values.length * 0.5)] : null;
  };
  const vocalMedian = relMedian('vocal');
  const airMedian = relMedian('air');
  const edgeMedian = relMedian('edge');
  const widths = bars.map((row) => row.width).filter(Number.isFinite).sort((a, b) => a - b);
  const widthMedian = widths.length ? widths[Math.floor(widths.length * 0.5)] : null;
  const above = (value, median, margin) => median != null && value != null && value > median + margin;
  const candidates = [];
  for (let b = 8; b + 8 < beats.length; b++) {
    const before = mean(beats, b - 4, 4, 'energy');
    const after = mean(beats, b, 4, 'energy');
    const lift = after - before;
    const bassLift = mean(beats, b, 4, 'low') - mean(beats, b - 4, 4, 'low');
    const onset = beats[b].energy - mean(beats, b - 2, 2, 'energy');
    const sustained = mean(beats, b + 4, 4, 'energy');
    // Reject gradual ramps and isolated drum hits: both onset and sustained energy must agree.
    if (lift < 1.5 || onset < 1.2 || bassLift < 0.5 || after < energetic - 1.5 ||
      after < -38 || sustained < after - 2) continue;
    const barIndex = Math.floor(b / 4);
    let repeated = false;
    for (let j = 0; j + 4 < bars.length; j++) {
      if (Math.abs(j - barIndex) < 12 || bars[j].energy < energetic - 1.5) continue;
      let difference = 0;
      for (let k = 0; k < 4 && barIndex + k < bars.length; k++) {
        difference += Math.abs(bars[barIndex + k].energy - bars[j + k].energy);
        difference += Math.abs((bars[barIndex + k].low - bars[barIndex + k].energy) -
          (bars[j + k].low - bars[j + k].energy));
      }
      if (difference / 8 < 1.25) { repeated = true; break; }
    }
    const intensity = Math.max(0, Math.min(1, (after - quiet) / spread));
    const confidence = Math.min(0.95, 0.5 + lift * 0.04 + bassLift * 0.02 + (repeated ? 0.1 : 0));
    if (confidence < 0.62) continue;
    const at = offset + b * beat;
    // Semnătura momentului, raportată la piesa însăși: ce fel de accent i se potrivește.
    // Se citește măsura de după atac — acolo se aude de fapt cum sună refrenul.
    const row = bars[barIndex + 1] || bars[barIndex];
    const rel = (key) => (row && Number.isFinite(row[key]) ? row[key] - row.energy : null);
    const vocal = above(rel('vocal'), vocalMedian, 1.2);
    const bright = above(rel('air'), airMedian, 1);
    const punch = above(rel('edge'), edgeMedian, 1);
    const wide = widthMedian != null && widthMedian > 0.02 && (row?.width ?? 0) > widthMedian * 1.15;
    // Unde începe de fapt urcușul: efectele intră peste build, nu doar peste 2 bătăi.
    let from = b;
    for (let k = b - 1; k >= Math.max(4, b - 16); k--) {
      if (beats[k + 1].energy - beats[k].energy < -0.8) break;
      from = k;
    }
    candidates.push({ at, buildAt: offset + from * beat, releaseAt: at + 8 * beat,
      kind: lift >= 4 && bassLift >= 3 ? 'drop' : repeated ? 'chorus' : 'peak',
      confidence, intensity, vocal, bright, punch, wide,
      strength: lift + bassLift * 0.4 + onset * 0.5 });
  }
  const selected = [];
  candidates.sort((a, b) => b.strength - a.strength).forEach((candidate) => {
    if (!selected.some((other) => Math.abs(other.at - candidate.at) < 32 * beat)) selected.push(candidate);
  });
  return selected.sort((a, b) => a.at - b.at).map(({ strength, ...event }) => event);
}