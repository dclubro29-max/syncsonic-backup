import { readCalibrationSessionById } from '@/lib/calibrationSession';
import { playBeep } from '@/lib/testTone';

const wait = (ms, signal) => new Promise((resolve, reject) => {
  const abort = () => {
    clearTimeout(timer);
    reject(new DOMException('Calibrare anulată.', 'AbortError'));
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', abort);
    resolve();
  }, ms);
  signal?.addEventListener('abort', abort, { once: true });
});

const roundValue = (value) => Math.round(value * 10) / 10;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

async function waitForSession(id, predicate, { timeout, interval, signal }) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    signal?.throwIfAborted();
    const session = await readCalibrationSessionById(id);
    if (session.status === 'cancelled' || session.closed_at) {
      throw new Error('Gazda a închis sesiunea de calibrare. Redarea revine la starea de dinainte.');
    }
    if (session.status === 'expired' || (Number(session.expires_at) > 0 && Date.now() > Number(session.expires_at))) {
      throw new Error('Sesiunea de calibrare a expirat. Pornește o probă nouă.');
    }
    if (predicate(session)) return session;
    await wait(interval, signal);
  }
  return null;
}

/**
 * Potrivește onset-urile detectate cu semnalele programate, fără să inventeze
 * un moment pentru un bip lipsă. Offset-ul dintre ceasul telefonului și cel al
 * gazdei este necunoscut, deci îl estimăm din fiecare onset candidat.
 */
function matchSignals(signals, onsets, levels) {
  const matches = signals.map((signal) => ({ signal, onset: null, level: null, detected: false }));
  if (!onsets.length) return matches;
  let best = null;
  // Offset-ul dintre ceasul telefonului și cel al gazdei este necunoscut.
  // Încercăm fiecare potrivire posibilă și preferăm cea care respectă atât
  // momentele, cât și intervalele distincte dintre semnale.
  const offsets = [];
  onsets.forEach((onset) => signals.forEach((signal) => {
    offsets.push(onset * 1000 - signal.at);
  }));
  offsets.forEach((offset) => {
    const used = new Set();
    const attempt = signals.map((signal) => {
      const expected = signal.at + offset;
      let bestIndex = -1;
      let bestDistance = Infinity;
      onsets.forEach((onset, index) => {
        if (used.has(index)) return;
        const distance = Math.abs(onset * 1000 - expected);
        if (distance < bestDistance && distance <= 300) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      if (bestIndex < 0) return { signal, onset: null, level: null, detected: false };
      used.add(bestIndex);
      return { signal, onset: onsets[bestIndex], level: levels[bestIndex] ?? null, detected: true };
    });
    const matched = attempt.filter((item) => item.detected);
    let score = matched.reduce((sum, item) => (
      sum + Math.abs(item.onset * 1000 - (item.signal.at + offset))
    ), 0);
    for (let index = 1; index < attempt.length; index += 1) {
      if (attempt[index].detected && attempt[index - 1].detected) {
        score += Math.abs(
          (attempt[index].onset - attempt[index - 1].onset) * 1000
          - (attempt[index].signal.at - attempt[index - 1].signal.at)
        ) * 1.5;
      }
    }
    if (!best || matched.length > best.count || (matched.length === best.count && score < best.score)) {
      best = { count: matched.length, score, attempt };
    }
  });
  if (!best || best.count === 0) return matches;
  return best.attempt;
}

/**
 * Programează semnalele pe ceasul audio al gazdei și citește doar momentele
 * detectate de telefon. Fiecare serie este repetată pentru boxele care nu au
 * fost detectate; o boxă ratată nu închide sesiunea și nu invalidează
 * măsurătorile celorlalte.
 */
export async function measurePhoneDelays({
  ctx, nodes, sessionId, updateSession, signal, preserveDelays = false,
  roundStart = 0, maxRounds = 5, minValidRounds = 2, testLevel = 0.34, frequency = 900,
  onProgress,
}) {
  const assertCurrent = () => {
    signal?.throwIfAborted();
    if (ctx.state !== 'running') throw new Error('Redarea audio s-a suspendat. Păstrează aplicația activă.');
    if (nodes.some((node) => node.isCurrent && !node.isCurrent())) {
      throw new Error('Conexiunea unei boxe s-a schimbat. Repetă alinierea după reconectare.');
    }
  };
  assertCurrent();
  const saved = nodes.map((node) => ({
    node,
    gate: node.gain.gain.value,
    delay: node.getDelay?.() ?? node.input.delayTime.value,
  }));
  const stats = new Map(nodes.map((node) => [node.deviceId, {
    node, values: [], valid: 0, relative: null, reason: 'Niciun semnal detectat.',
  }]));
  try {
    nodes.forEach((node) => {
      if (!preserveDelays) {
        node.input.delayTime.cancelScheduledValues(0);
        node.input.delayTime.setValueAtTime(0, ctx.currentTime);
      } else {
        const current = node.input.delayTime.value;
        node.input.delayTime.cancelScheduledValues(0);
        node.input.delayTime.setValueAtTime(current, ctx.currentTime);
      }
      node.gain.gain.cancelScheduledValues(0);
      node.gain.gain.setValueAtTime(1, ctx.currentTime);
    });
    await wait(preserveDelays ? 350 : 750, signal);
    const rounds = [];
    let lastRound = roundStart - 1;

    for (let index = 0; index < maxRounds; index += 1) {
      assertCurrent();
      const pending = nodes.filter((node) => stats.get(node.deviceId).valid < minValidRounds);
      if (!pending.length) break;
      // Când repetăm doar boxele ratate, păstrăm o boxă deja măsurată ca
      // referință, ca diferența dintre ele să rămână comparabilă.
      const reference = pending.length < nodes.length
        ? nodes.find((node) => !pending.includes(node) && stats.get(node.deviceId).valid > 0) || null
        : null;
      const activeNodes = reference ? [...pending, reference] : pending;
      const round = roundStart + index;
      lastRound = round;
      const order = index % 2 === 0 ? 'forward' : 'reverse';
      const ordered = order === 'forward' ? activeNodes : [...activeNodes].reverse();
      const signals = ordered.map((node, signalIndex) => ({
        id: `${round}-${signalIndex}`,
        deviceId: node.deviceId,
        at: 900 + signalIndex * 520 + (signalIndex > 1 ? 260 : 0),
        duration: 260,
        round,
        order,
      }));
      const roundKey = signals.map((item) => item.id).join('|');

      await updateSession({
        status: 'measuring',
        round_index: round,
        phone_ready: false,
        signals,
      });
      onProgress?.({ phase: 'round', round, total: maxRounds, order, signals });
      const ready = await waitForSession(
        sessionId,
        (session) => session.round_index === round && session.phone_ready === true,
        { timeout: 12000, interval: 450, signal }
      );
      if (!ready) throw new Error('Telefonul nu a confirmat captura. Ține ecranul aprins și încearcă din nou.');

      const startAt = ctx.currentTime + 0.45;
      signals.forEach((definition) => {
        const node = nodes.find((item) => item.deviceId === definition.deviceId);
        if (!node) return;
        playBeep(ctx, node.input, definition.duration, frequency, startAt + definition.at / 1000, signal, { level: testLevel });
      });

      const measured = await waitForSession(
        sessionId,
        (session) => session.round_index === round
          && (session.rounds || []).some((item) => item.round === round
            && (item.round_key === roundKey
              || (item.signal_ids || []).join('|') === roundKey)),
        { timeout: 12000, interval: 450, signal }
      );
      if (!measured) throw new Error('Telefonul nu a trimis seria de măsurători. Verifică ecranul telefonului.');
      const result = (measured.rounds || []).find((item) => item.round === round
        && (item.round_key === roundKey || (item.signal_ids || []).join('|') === roundKey));
      if (!result) {
        pending.forEach((node) => { stats.get(node.deviceId).reason = 'Rezultatul seriei a fost pierdut.'; });
        continue;
      }
      const matches = matchSignals(signals, result.onsets || [], result.levels || []);
      const detected = matches.filter((item) => item.detected);
      const travels = new Map(detected.map((item) => [item.signal.deviceId, item.onset * 1000 - item.signal.at]));
      const referenceNode = reference;
      const referenceTravel = referenceNode ? travels.get(referenceNode.deviceId) : null;
      const referenceRelative = referenceNode ? stats.get(referenceNode.deviceId).relative : null;
      const mean = detected.length
        ? detected.reduce((sum, item) => sum + (item.onset * 1000 - item.signal.at), 0) / detected.length
        : 0;

      matches.forEach((item) => {
        const stat = stats.get(item.signal.deviceId);
        if (!stat || item.signal.deviceId === referenceNode?.deviceId) return;
        const travel = travels.get(item.signal.deviceId);
        if (!item.detected || !Number.isFinite(travel)) {
          stat.reason = result.error || 'Un bip nu a fost detectat. Repet seria pentru această boxă.';
          return;
        }
        let relative;
        if (referenceNode) {
          if (!Number.isFinite(referenceTravel) || !Number.isFinite(referenceRelative)) {
            stat.reason = 'Boxa de referință nu a fost auzită. Repet seria.';
            return;
          }
          relative = (travel - referenceTravel) + referenceRelative;
        } else {
          relative = travel - mean;
        }
        stat.values.push(relative);
        stat.valid += 1;
        stat.relative = median(stat.values);
        stat.reason = null;
      });

      rounds.push({
        order, round, round_key: roundKey, quality: result.quality,
        onsets: result.onsets || [], detected: matches.map((item) => ({
          deviceId: item.signal.deviceId, detected: item.detected, onset: item.onset,
        })),
      });
      onProgress?.({
        phase: 'round', round, total: maxRounds, order,
        detected: detected.length,
        signals: signals.length,
        spread: detected.length > 1
          ? roundValue(Math.max(...detected.map((item) => item.onset * 1000 - item.signal.at))
            - Math.min(...detected.map((item) => item.onset * 1000 - item.signal.at)))
          : null,
        unmeasured: nodes.filter((node) => stats.get(node.deviceId).valid < minValidRounds)
          .map((node) => node.deviceId),
      });
    }

    const measuredNodes = nodes.filter((node) => stats.get(node.deviceId).valid >= minValidRounds);
    const unmeasured = nodes.filter((node) => stats.get(node.deviceId).valid < minValidRounds)
      .map((node) => ({
        deviceId: node.deviceId,
        measured: false,
        valid: stats.get(node.deviceId).valid,
        reason: stats.get(node.deviceId).reason || 'Semnalul nu a fost detectat cu încredere suficientă.',
        delay: Math.round((node.getDelay?.() ?? 0) * 1000),
      }));
    if (!measuredNodes.length) {
      const error = new Error('Telefonul nu a detectat niciun semnal. Verifică volumul, microfonul și apropierea de boxe; sesiunea rămâne deschisă.');
      error.code = 'CALIBRATION_NO_SIGNAL';
      throw error;
    }

    const results = measuredNodes.map((node) => {
      const values = stats.get(node.deviceId).values;
      const relative = median(values);
      const spread = Math.max(...values) - Math.min(...values);
      return {
        deviceId: node.deviceId,
        measured: true,
        arrival: relative,
        relative,
        uncertainty: Math.ceil(spread / 2 + 5.3),
        spread,
        valid: values.length,
        delay: preserveDelays
          ? Math.round((node.getDelay?.() ?? 0) * 1000)
          : 0,
      };
    });
    const slowest = Math.max(...results.map((item) => item.arrival));
    const physicalSpread = slowest - Math.min(...results.map((item) => item.arrival));
    results.forEach((item) => {
      if (!preserveDelays) item.delay = Math.round(slowest - item.arrival);
    });
    return {
      results,
      unmeasured,
      measured: results.length,
      partial: unmeasured.length > 0,
      spread: roundValue(physicalSpread),
      uncertainty: Math.max(...results.map((item) => item.uncertainty)),
      rounds,
      lastRound,
    };
  } finally {
    if (ctx.state !== 'closed') {
      saved.forEach(({ node, gate, delay }) => {
        node.input.delayTime.cancelScheduledValues(0);
        node.input.delayTime.setValueAtTime(
          preserveDelays ? (node.getDelay?.() ?? delay) : delay,
          ctx.currentTime
        );
        node.gain.gain.cancelScheduledValues(0);
        node.gain.gain.setValueAtTime(gate, ctx.currentTime);
      });
    }
  }
}
