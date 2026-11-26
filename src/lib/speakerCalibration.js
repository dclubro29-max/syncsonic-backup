import { createCalibrationCapture } from '@/lib/calibrationCapture';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => Math.round(value * 10) / 10;

/**
 * Măsoară când ajunge impulsul la fiecare ieșire.
 *
 * `preserveDelays: false` — întârzierile sunt aduse la 0, deci rezultatul este
 * diferența fizică reală; compensarea se calculează față de boxa cea mai lentă.
 * `preserveDelays: true` — întârzierile deja aplicate rămân active, iar
 * rezultatul este diferența rămasă la punctul de ascultare.
 */
export async function measureOutputDelays({ ctx, nodes, onProgress, microphoneId, signal, frequency = 1500, preserveDelays = false, maxSpread = 500 }) {
  const assertCurrent = () => {
    signal?.throwIfAborted();
    if (ctx.state !== 'running') throw new Error('Redarea audio s-a suspendat. Păstrează aplicația activă.');
    if (nodes.some((node) => node.isCurrent && !node.isCurrent())) {
      throw new Error('Conexiunea unei boxe s-a schimbat. Repetă alinierea după reconectare.');
    }
  };
  assertCurrent();
  const capture = await createCalibrationCapture(ctx, { microphoneId, signal });
  const saved = nodes.map((node) => ({
    node,
    gate: node.gain.gain.value,
    delay: node.getDelay?.() ?? node.input.delayTime.value,
  }));
  try {
    assertCurrent();
    nodes.forEach((node) => {
      if (!preserveDelays) {
        // Cancel old ramps too; assigning .value alone does not override automation.
        node.input.delayTime.cancelScheduledValues(0);
        node.input.delayTime.setValueAtTime(0, ctx.currentTime);
      } else {
        // Freeze the delay being measured; a slider ramp must not move it mid-probe.
        const current = node.input.delayTime.value;
        node.input.delayTime.cancelScheduledValues(0);
        node.input.delayTime.setValueAtTime(current, ctx.currentTime);
      }
      node.gain.gain.cancelScheduledValues(0);
      node.gain.gain.setValueAtTime(0, ctx.currentTime);
    });
    // Drain the previous music and Bluetooth/delay buffers before measuring noise.
    await wait(preserveDelays ? 350 : 750);
    const results = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      assertCurrent();
      const appliedDelay = node.getDelay?.() ?? node.input.delayTime.value;
      node.gain.gain.setValueAtTime(1, ctx.currentTime);
      const samples = [];
      for (let trial = 0; trial < 3; trial++) {
        assertCurrent();
        onProgress?.(i, nodes.length, trial + 1);
        const arrival = await capture.listen(node.input, frequency);
        if (arrival == null) throw new Error(`Boxa ${i + 1} nu a fost auzită clar. Verifică volumul și microfonul; întârzierile vechi rămân neschimbate.`);
        samples.push(arrival);
        await wait(250);
      }
      node.gain.gain.setValueAtTime(0, ctx.currentTime);
      samples.sort((a, b) => a - b);
      const spread = samples[2] - samples[0];
      if (spread > 12) throw new Error(`Boxa ${i + 1} are latență variabilă (${Math.round(spread)} ms). Nu aplic o aliniere nesigură; păstrează microfonul fix și verifică legătura audio.`);
      results.push({ deviceId: node.deviceId, arrival: samples[1], measured: true,
        uncertainty: Math.ceil(spread / 2 + 256000 / ctx.sampleRate), appliedDelay });
    }
    assertCurrent();
    const slowest = Math.max(...results.map((result) => result.arrival));
    const fastest = Math.min(...results.map((result) => result.arrival));
    const physicalSpread = slowest - fastest;
    if (physicalSpread > maxSpread) {
      throw new Error(`Diferența dintre boxe depășește limita de ${maxSpread} ms. Nu am schimbat calibrarea.`);
    }
    return {
      results: results.map((result) => ({
        ...result,
        delay: preserveDelays
          ? Math.round(result.appliedDelay * 1000)
          : Math.round(slowest - result.arrival),
      })),
      spread: round(physicalSpread),
      uncertainty: Math.max(...results.map((result) => result.uncertainty)),
    };
  } finally {
    // Restore gates AND delays on success, permission errors, timeouts and aborts.
    try {
      if (ctx.state !== 'closed') saved.forEach(({ node, gate, delay }) => {
        node.input.delayTime.cancelScheduledValues(0);
        node.input.delayTime.setValueAtTime(
          preserveDelays ? (node.getDelay?.() ?? delay) : delay,
          ctx.currentTime
        );
        node.gain.gain.cancelScheduledValues(0);
        node.gain.gain.setValueAtTime(gate, ctx.currentTime);
      });
    } finally { capture.close(); }
  }
}