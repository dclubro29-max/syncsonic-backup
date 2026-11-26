import { useCallback, useEffect, useRef, useState } from "react";
import { useDj } from "@/lib/djContext";
import { PILOT_INTERVAL_MS } from "@/lib/pilotSync";

const ON_KEY = "musicsync.concertSync";
const HZ_KEY = "musicsync.concertHz";

const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    /* ignore */
  }
};

/** Pre-set checks only: microphone/delay changes are forbidden during playback. */
export function useConcertSync() {
  const dj = useDj();
  const djRef = useRef(dj);
  djRef.current = dj;

  // Never reopen a microphone just because a previous session had it enabled.
  const [on, setOn] = useState(false);
  const [frequency, setFrequencyState] = useState(1500);
  const [status, setStatus] = useState({ phase: "off", message: "", results: [], corrected: 0, spread: null });
  const [nextAt, setNextAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const setFrequency = useCallback((hz) => {
    setFrequencyState(hz);
    write(HZ_KEY, String(hz));
  }, []);

  const checkNow = useCallback(async () => {
    const engine = djRef.current;
    // Reopening a Bluetooth mic during a set can switch A2DP to telephone audio.
    // Changing delay during music also changes its pitch. Never do either live.
    const playing = engine.decks.some((_, index) => {
      const audio = engine.getDeckAudio(index);
      return audio && !audio.paused && !audio.ended;
    });
    if (playing || engine.autoDj.on || engine.partyMode.on || engine.calibrationBusy) {
      setStatus((previous) => ({ ...previous, phase: 'paused',
        message: 'Verificarea este suspendată în timpul redării. Calibrarea se face înainte de set, cu muzica și Auto DJ oprite.' }));
      return;
    }
    setStatus((previous) => ({ ...previous, phase: 'measuring', message: '' }));

    try {
      const calibrated = await engine.calibrateOutputs({ frequency });
      setStatus({ phase: 'done', message: 'Compensare aplicată; confirmă prin ascultare.',
        results: calibrated.map((result) => ({ ...result, latency: result.arrival })),
        corrected: calibrated.length, spread: null });
    } catch (error) {
      setStatus({ phase: 'error', message: error.name === 'NotAllowedError'
        ? 'Permite accesul la microfonul integrat/USB. Nu a fost modificată calibrarea.'
        : error.message || 'Calibrarea nu a reușit; reglajele vechi au fost păstrate.',
        results: [], corrected: 0, spread: null });
    }
  }, [frequency]);

  useEffect(() => {
    if (!on) {
      setStatus({ phase: "off", message: "", results: [], corrected: 0, spread: null });
      setNextAt(0);
      return;
    }

    let stopped = false;
    let timer = null;

    const loop = async () => {
      // Cu fila în fundal măsurătoarea nu e de încredere, așa că o sărim.
      if (!document.hidden) await checkNow();
      if (stopped) return;
      setNextAt(Date.now() + PILOT_INTERVAL_MS);
      timer = setTimeout(loop, PILOT_INTERVAL_MS);
    };

    loop();

    return () => {
      stopped = true;
      clearTimeout(timer);
      setNextAt(0);
    };
  }, [on, checkNow]);

  const setEnabled = useCallback(async (value) => {
    if (value) {
      try {
        await djRef.current.ensureAudio();
      } catch (e) {
        /* sunetul pornește oricum la prima redare */
      }
    }
    setOn(value);
    write(ON_KEY, value ? "1" : "0");
  }, []);

  const secondsToNext = nextAt ? Math.max(0, Math.round((nextAt - now) / 1000)) : null;

  return { on, setEnabled, frequency, setFrequency, status, secondsToNext, checkNow };
}