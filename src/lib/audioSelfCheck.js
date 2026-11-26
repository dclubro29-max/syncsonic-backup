/**
 * Verificarea audio de ~2 minute: redă piesa de pe un deck și măsoară la
 * ieșirea master fiecare verigă a motorului — EQ, echo, reverb, filtre,
 * automatizarea tranziției (bass împărțit), crossfader, limiter, boxe.
 *
 * Fiecare pas spune ce ar trebui să se audă și ce s-a măsurat de fapt, ca să
 * nu rămână nicio îndoială dacă un efect ajunge sau nu în boxe.
 */

export const AUDIO_CHECK_STEPS = [
  { id: 'motor', title: 'Motorul audio', hint: 'Piesa pornește și ajunge la ieșire' },
  { id: 'bass', title: 'Bass +6 dB', hint: 'Se îngroașă basul piesei' },
  { id: 'inalte', title: 'Înalte +6 dB', hint: 'Se deschid cinelele și vocile' },
  { id: 'echo', title: 'Echo', hint: 'Repetiții după ce piesa tace' },
  { id: 'reverb', title: 'Reverb', hint: 'Coada de spațiu după piesă' },
  { id: 'filtru-jos', title: 'Filtru trece-jos', hint: 'Piesa devine înfundată' },
  { id: 'filtru-sus', title: 'Filtru trece-sus', hint: 'Piesa devine subțire' },
  { id: 'bass-split', title: 'Bass împărțit', hint: 'Ca la tranziție: basul coboară lin' },
  { id: 'crossfader', title: 'Crossfader', hint: 'Deckul scade până la tăcere' },
  { id: 'limiter', title: 'Limiter și master', hint: 'Protecția de vârf e activă' },
  { id: 'boxe', title: 'Boxe și întârziere', hint: 'Ieșirile selectate pentru sunet' },
];

/** Durata estimată, folosită pentru bara de progres. */
export const AUDIO_CHECK_MS = 110000;

const LISTEN_MS = 5000;

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const stop = () => {
      clearTimeout(id);
      reject(new DOMException('aborted', 'AbortError'));
    };
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', stop);
      resolve();
    }, ms);
    signal?.addEventListener('abort', stop, { once: true });
  });

/** Primul deck care are o piesă încărcată; altfel null. */
export function pickSelfCheckDeck(dj) {
  const decks = dj?.decks || [];
  const index = decks.findIndex((deck) => deck?.track);
  return index === -1 ? null : index;
}

const db = (value) => 20 * Math.log10(Math.max(value, 0.0005));
const delta = (after, before) => db(after) - db(before);

/** Energie pe benzi, din spectrul master (0…1). */
function bands(spectrum, sampleRate) {
  const binHz = sampleRate / 2 / spectrum.length;
  const average = (lo, hi) => {
    const from = Math.max(1, Math.floor(lo / binHz));
    const to = Math.min(spectrum.length - 1, Math.ceil(hi / binHz));
    let sum = 0, count = 0;
    for (let i = from; i <= to; i++) {
      sum += spectrum[i];
      count++;
    }
    return count ? sum / count / 255 : 0;
  };
  return { low: average(35, 160), mid: average(400, 2500), high: average(4500, 12000) };
}

/** Media nivelului și a benzilor pe durata dată — „ce se aude acum". */
async function sample(dj, ms, signal) {
  const ctx = dj.getAudioContext();
  let level = 0, low = 0, mid = 0, high = 0, count = 0;
  const end = performance.now() + ms;
  while (performance.now() < end) {
    const meter = dj.getMasterMeter?.();
    const spectrum = dj.getSpectrum?.();
    level += meter?.level ?? 0;
    if (spectrum && ctx) {
      const b = bands(spectrum, ctx.sampleRate);
      low += b.low;
      mid += b.mid;
      high += b.high;
    }
    count++;
    await sleep(60, signal);
  }
  return count
    ? { level: level / count, low: low / count, mid: mid / count, high: high / count }
    : { level: 0, low: 0, mid: 0, high: 0 };
}

/**
 * Rulează toată verificarea. `onStep(id, patch)` primește starea fiecărui pas:
 * `running`, apoi `ok` / `weak` / `fail` / `skip` plus detaliul măsurat.
 * La final, deckul revine exact la reglajele de dinainte.
 */
export async function runAudioSelfCheck({ dj, deck, onStep, signal }) {
  let audio = dj.getDeckAudio(deck);
  const state = dj.decks[deck] || {};
  const original = {
    eq: { low: 0, mid: 0, high: 0, ...(state.eq || {}) },
    fx: { echo: 0, reverb: 0, filter: 0, ...(state.fx || {}) },
    crossfade: dj.crossfade ?? 0.5,
    paused: audio?.paused ?? true,
    time: audio?.currentTime ?? 0,
    loop: audio?.loop ?? false,
  };

  const restore = () => {
    if (!audio) return;
    dj.resetDeckAutomation(deck, { keepTempo: true });
    dj.setEq(deck, 'low', original.eq.low);
    dj.setEq(deck, 'mid', original.eq.mid);
    dj.setEq(deck, 'high', original.eq.high);
    dj.setFx(deck, 'echo', original.fx.echo);
    dj.setFx(deck, 'reverb', original.fx.reverb);
    dj.setFx(deck, 'filter', original.fx.filter);
    dj.setCrossfade(original.crossfade);
    audio.loop = original.loop;
    if (Number.isFinite(original.time)) audio.currentTime = original.time;
    // Redarea se oprește prin motor, ca butonul deckului să rămână sincron.
    if (original.paused && !audio.paused) dj.togglePlay(deck);
    else if (!original.paused && audio.paused) dj.togglePlay(deck);
  };

  const report = (id, status, detail) => onStep(id, { status, detail });
  const step = (id) => onStep(id, { status: 'running', detail: null });

  try {
    await dj.ensureAudio();
    audio = dj.getDeckAudio(deck);
    if (dj.neutral || dj.abBypass) dj.enableDjProcessing();

    /* 1. Motorul: piesa trebuie să ajungă la ieșire. */
    step('motor');
    dj.setCrossfade(deck === 0 ? 0 : 1);
    if (audio) {
      audio.loop = true;
      if (audio.duration && audio.currentTime > audio.duration * 0.6) {
        audio.currentTime = audio.duration * 0.1;
      }
    }
    if (audio?.paused) await dj.togglePlay(deck);
    await sleep(800, signal);
    const base = await sample(dj, LISTEN_MS, signal);
    report('motor', base.level > 0.01 ? 'ok' : 'fail',
      base.level > 0.01 ? `${Math.round(db(base.level))} dB la ieșire` : 'Nimic nu ajunge la ieșire');

    /* 2. Bass. */
    step('bass');
    await sleep(500, signal);
    dj.setEq(deck, 'low', original.eq.low + 6);
    await sleep(600, signal);
    const bassUp = await sample(dj, LISTEN_MS, signal);
    dj.setEq(deck, 'low', original.eq.low);
    const bassDb = delta(bassUp.low, base.low);
    report('bass', bassDb > 1.5 ? 'ok' : bassDb > 0.6 ? 'weak' : 'fail', `${bassDb.toFixed(1)} dB măsurat`);

    /* 3. Înalte. */
    step('inalte');
    await sleep(400, signal);
    dj.setEq(deck, 'high', original.eq.high + 6);
    await sleep(600, signal);
    const highUp = await sample(dj, LISTEN_MS, signal);
    dj.setEq(deck, 'high', original.eq.high);
    const highDb = delta(highUp.high, base.high);
    report('inalte', highDb > 1.2 ? 'ok' : highDb > 0.5 ? 'weak' : 'fail', `${highDb.toFixed(1)} dB măsurat`);

    /* 4. Echo: după ce piesa tace, doar ecoul mai poate suna. */
    step('echo');
    dj.setFx(deck, 'echo', 0.9);
    await sleep(2600, signal);
    await dj.togglePlay(deck);
    await sleep(420, signal);
    const echoTail = await sample(dj, 1200, signal);
    dj.setFx(deck, 'echo', 0);
    if (audio?.paused) await dj.togglePlay(deck);
    await sleep(500, signal);
    report('echo', echoTail.level > 0.012 ? 'ok' : echoTail.level > 0.005 ? 'weak' : 'fail',
      `${Math.round(db(echoTail.level))} dB coadă`);

    /* 5. Reverb. */
    step('reverb');
    dj.setFx(deck, 'reverb', 0.95);
    await sleep(2600, signal);
    await dj.togglePlay(deck);
    await sleep(750, signal);
    const reverbTail = await sample(dj, 1600, signal);
    dj.setFx(deck, 'reverb', 0);
    if (audio?.paused) await dj.togglePlay(deck);
    await sleep(500, signal);
    report('reverb', reverbTail.level > 0.012 ? 'ok' : reverbTail.level > 0.005 ? 'weak' : 'fail',
      `${Math.round(db(reverbTail.level))} dB coadă`);

    /* 6. Filtru trece-jos. */
    step('filtru-jos');
    await sleep(400, signal);
    dj.setFx(deck, 'filter', -0.45);
    await sleep(600, signal);
    const lowpass = await sample(dj, LISTEN_MS, signal);
    dj.setFx(deck, 'filter', original.fx.filter);
    const lowpassDb = delta(lowpass.high, base.high);
    report('filtru-jos', lowpassDb < -2 ? 'ok' : lowpassDb < -0.7 ? 'weak' : 'fail',
      `înalte ${lowpassDb.toFixed(1)} dB`);

    /* 7. Filtru trece-sus. */
    step('filtru-sus');
    await sleep(400, signal);
    dj.setFx(deck, 'filter', 0.45);
    await sleep(600, signal);
    const highpass = await sample(dj, LISTEN_MS, signal);
    dj.setFx(deck, 'filter', original.fx.filter);
    const highpassDb = delta(highpass.low, base.low);
    report('filtru-sus', highpassDb < -2 ? 'ok' : highpassDb < -0.7 ? 'weak' : 'fail',
      `bass ${highpassDb.toFixed(1)} dB`);

    /* 8. Automatizarea tranziției: bass-ul coboară exact ca la mix. */
    step('bass-split');
    await sleep(400, signal);
    const preSplit = await sample(dj, 2500, signal);
    dj.automateDeckEq(deck, 'low', [{ to: original.eq.low - 12, over: 0.4 }]);
    await sleep(700, signal);
    const postSplit = await sample(dj, 3500, signal);
    dj.resetDeckAutomation(deck, { keepTempo: true });
    const splitDb = delta(postSplit.low, preSplit.low);
    report('bass-split', splitDb < -4 ? 'ok' : splitDb < -1.5 ? 'weak' : 'fail',
      `bass ${splitDb.toFixed(1)} dB`);

    /* 9. Crossfader. */
    step('crossfader');
    await sleep(400, signal);
    const preFader = await sample(dj, 3000, signal);
    dj.crossfadeOver(deck === 0 ? 1 : 0, 0.3);
    await sleep(700, signal);
    const postFader = await sample(dj, 3000, signal);
    dj.setCrossfade(deck === 0 ? 0 : 1);
    const faderDb = delta(postFader.level, preFader.level);
    report('crossfader', faderDb < -6 ? 'ok' : faderDb < -2 ? 'weak' : 'fail',
      `${faderDb.toFixed(1)} dB pe deck`);

    /* 10. Limiter și master. */
    step('limiter');
    await sleep(600, signal);
    const reduction = Math.round(dj.getLimiterReduction?.() ?? 0);
    report('limiter', dj.limiterOn ? 'ok' : 'weak',
      dj.limiterOn ? `activ · reducere ${reduction} dB` : 'oprit — vârfurile nu sunt prinse');

    /* 11. Ieșiri. */
    step('boxe');
    await sleep(300, signal);
    const outputs = dj.outputs || [];
    const delayed = outputs.filter((o) => (o.delay || 0) > 0).length;
    report('boxe', outputs.length ? 'ok' : 'skip',
      outputs.length ? `${outputs.length} ieșiri · ${delayed} cu întârziere` : 'nicio ieșire selectată');
  } finally {
    restore();
  }
}