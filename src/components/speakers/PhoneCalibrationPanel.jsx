import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, Copy, Loader2, QrCode, RotateCcw, Smartphone, TriangleAlert, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useDj } from '@/lib/djContext';
import { Button } from '@/components/ui/button';
import StatusPill from '@/components/ui-kit/StatusPill';
import CalibrationQr from '@/components/speakers/CalibrationQr';
import {
  closeCalibrationSession, createCalibrationSession, isSessionExpired,
  readCalibrationSessionById, sessionLink, updateCalibrationSession,
} from '@/lib/calibrationSession';

const PHASE_TEXT = {
  creating: 'Pregătesc sesiunea…',
  waiting: 'Aștept telefonul. Scanează codul QR.',
  capturing: 'Telefonul captează. Pornesc semnalele…',
  measuring: 'Măsor. Nu mișca telefonul.',
  done: 'Măsurătoare încheiată.',
  retry: 'Unele boxe nu au fost auzite.',
  expired: 'Sesiunea a expirat.',
  cancelled: 'Sesiune închisă.',
  error: 'Măsurătoarea nu a reușit.',
};

const round = (value) => Math.round(value * 10) / 10;

const sessionResult = (outcome) => ({
  before: round(outcome.before?.spread ?? 0),
  after: round(outcome.after?.spread ?? 0),
  uncertainty: round(outcome.after?.uncertainty ?? 0),
  verified: !!outcome.verified,
  message: outcome.reason || (outcome.verified
    ? `Aliniere verificată: ${round(outcome.before?.spread ?? 0)} ms → ${round(outcome.after?.spread ?? 0)} ms.`
    : `Aliniere parțială: ${round(outcome.after?.spread ?? 0)} ms după compensare.`),
  delays: (outcome.after?.results || []).map(({ deviceId, delay }) => ({ deviceId, delay })),
  uncalibrated: (outcome.unmeasured || []).map(({ deviceId, reason }) => ({ deviceId, reason })),
});

export default function PhoneCalibrationPanel({ zone, outputs, disabled, onStatus, onResult, onClose }) {
  const { alignWithPhone, cancelCalibration, retryPhoneBox } = useDj();
  const [session, setSession] = useState(null);
  const [phase, setPhase] = useState('creating');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [retryOutcome, setRetryOutcome] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [testLevel, setTestLevel] = useState(0.34);
  const [runToken, setRunToken] = useState(0);
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const sessionRef = useRef(null);
  const statusRef = useRef(onStatus);
  const resultRef = useRef(onResult);
  const zoneRef = useRef(zone);
  const outputsRef = useRef(outputs);
  statusRef.current = onStatus;
  resultRef.current = onResult;
  zoneRef.current = zone;
  outputsRef.current = outputs;

  useEffect(() => {
    let active = true;
    if (disabled) {
      setPhase('error');
      setError('Oprește Auto DJ, modul Petrecere sau modul de urgență înainte de alinierea cu telefonul.');
      return () => {};
    }
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!active) return;
        if (!authed) {
          setPhase('error');
          setError('Autentifică-te pe laptop înainte de a porni o sesiune securizată de calibrare.');
          return;
        }
        const created = await createCalibrationSession({ zone: zoneRef.current, outputs: outputsRef.current });
        if (!active) {
          closeCalibrationSession(created.id).catch(() => {});
          return;
        }
        sessionRef.current = created;
        setSession(created);
        setPhase('waiting');
        statusRef.current?.({ ok: true, text: 'Sesiune pregătită. Scanează codul QR cu telefonul.' });
      } catch (err) {
        if (active) {
          setPhase('error');
          setError(err?.status === 403 || /permission|denied/i.test(err?.message || '')
            ? 'Autentifică-te pe laptop înainte de a porni o sesiune securizată de calibrare.'
            : err.message || 'Sesiunea de calibrare nu a putut fi pornită.');
        }
      }
    })();
    return () => {
      active = false;
      if (!finishedRef.current && sessionRef.current) {
        closeCalibrationSession(sessionRef.current.id).catch(() => {});
      }
    };
  }, [disabled]);

  useEffect(() => {
    const id = session?.id;
    if (!id) return undefined;
    let active = true;
    const tick = async () => {
      try {
        const next = await readCalibrationSessionById(id);
        if (!active || !next) return;
        sessionRef.current = next;
        setSession(next);
        if (isSessionExpired(next)) {
          finishedRef.current = true;
          setPhase('expired');
          await updateCalibrationSession(id, { status: 'expired', phone_ready: false }).catch(() => {});
          return;
        }
        if (next.status === 'cancelled') {
          finishedRef.current = true;
          setPhase('cancelled');
          return;
        }
        if (next.status === 'done') {
          finishedRef.current = true;
          setPhase('done');
          return;
        }
        if (next.capture_confirmed && next.status === 'capturing' && !startedRef.current) {
          startedRef.current = true;
          setPhase('measuring');
          statusRef.current?.({ ok: true, text: 'Telefonul captează. Pornesc semnalele pe rând.' });
          try {
            const outcome = await alignWithPhone({
              sessionId: id,
              zone: zoneRef.current,
              testLevel,
              updateSession: (patch) => updateCalibrationSession(id, patch),
              onProgress: (update) => {
                if (!active) return;
                setProgress(update);
                const label = update.phase === 'baseline'
                  ? 'Starea actuală' : update.phase === 'physical'
                    ? 'Diferența fizică' : update.phase === 'after'
                      ? 'După compensare' : 'Verificare';
                statusRef.current?.({
                  ok: true,
                  text: `${label} · seria ${update.round + 1}${update.detected != null ? ` · ${update.detected}/${update.signals} semnale` : ''}${update.spread != null ? ` · diferență ${round(update.spread)} ms` : ''}…`,
                });
              },
            });
            if (!active) return;
            if (outcome.partial && outcome.unmeasured?.length) {
              setRetryOutcome(outcome);
              setPhase('retry');
              await updateCalibrationSession(id, {
                status: 'capturing',
                phone_ready: false,
                result: sessionResult(outcome),
              }).catch(() => {});
              statusRef.current?.({
                ok: false,
                text: `${outcome.unmeasured.length} ${outcome.unmeasured.length === 1 ? 'boxă nu a fost auzită' : 'boxe nu au fost auzite'}. Repetă doar boxele lipsă sau continuă cu cele detectate.`,
              });
              return;
            }
            finishedRef.current = true;
            const message = outcome.ok
              ? outcome.verified
                ? `Aliniere cu telefonul verificată: ${round(outcome.before.spread)} ms → ${round(outcome.after.spread)} ms.`
                : `Aliniere parțială: ${round(outcome.after.spread)} ms după compensare, peste ținta de 10 ms.`
              : outcome.reason;
            await updateCalibrationSession(id, {
              status: 'done',
              result: sessionResult(outcome),
            }).catch(() => {});
            setResult(outcome);
            setPhase('done');
            statusRef.current?.({ ok: outcome.ok, text: message });
            resultRef.current?.(outcome);
          } catch (err) {
            if (!active) return;
            if (err.code === 'CALIBRATION_PARTIAL' || err.code === 'CALIBRATION_NO_SIGNAL') {
              const details = err.details || {};
              const unmeasured = details.unmeasured?.length
                ? details.unmeasured
                : (sessionRef.current?.outputs || []).map((output) => ({
                    deviceId: output.deviceId,
                    reason: err.message,
                  }));
              const partial = {
                ok: false, applied: false, partial: true,
                unmeasured,
                physical: { results: details.measured || [], unmeasured },
                after: { results: details.measured || [], spread: 0, uncertainty: 0 },
                before: { spread: 0 },
              };
              setRetryOutcome(partial);
              setPhase('retry');
              await updateCalibrationSession(id, {
                status: 'capturing',
                phone_ready: false,
                result: sessionResult(partial),
              }).catch(() => {});
              statusRef.current?.({ ok: false, text: err.message });
              return;
            }
            const message = err.name === 'AbortError'
              ? 'Aliniere anulată. Reglajele și redarea au revenit la starea de dinainte.'
              : err.message || 'Alinierea cu telefonul nu a reușit; reglajele anterioare au fost păstrate.';
            if (err.name === 'AbortError') {
              finishedRef.current = true;
              await updateCalibrationSession(id, { status: 'cancelled', closed_at: Date.now(), phone_ready: false }).catch(() => {});
              setPhase('cancelled');
            } else {
              setPhase('error');
            }
            setError(message);
            statusRef.current?.({ ok: false, text: message });
          }
        }
      } catch (err) {
        if (active) setError(err.message || 'Sesiunea nu poate fi citită.');
      }
    };
    tick();
    const timer = setInterval(tick, 700);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session?.id, alignWithPhone, testLevel, runToken]);

  const close = async () => {
    finishedRef.current = true;
    if (phase === 'measuring') cancelCalibration({ restore: true });
    if (sessionRef.current?.id) await closeCalibrationSession(sessionRef.current.id).catch(() => {});
    onClose?.();
  };

  const copy = async () => {
    if (!session?.code) return;
    try {
      await navigator.clipboard.writeText(sessionLink(session.code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      setError('Linkul nu a putut fi copiat. Selectează-l manual.');
    }
  };

  const finishWithDetected = async (outcome) => {
    if (!outcome || (outcome.physical?.results || []).length < 2) {
      setError('Nu există destule boxe măsurate pentru o compensare. Repetă boxele lipsă.');
      return;
    }
    finishedRef.current = true;
    const finalOutcome = { ...outcome, ok: true, applied: true };
    await updateCalibrationSession(sessionRef.current.id, {
      status: 'done',
      result: sessionResult(finalOutcome),
    }).catch(() => {});
    setResult(finalOutcome);
    setPhase('done');
    statusRef.current?.({
      ok: true,
      text: `Continuat cu ${finalOutcome.physical.results.length} boxe detectate${finalOutcome.unmeasured?.length ? `; ${finalOutcome.unmeasured.length} rămân necalibrate` : ''}.`,
    });
    resultRef.current?.(finalOutcome);
  };

  const retryAll = () => {
    if (retrying) return;
    setRetryOutcome(null);
    setError('');
    setPhase('measuring');
    startedRef.current = false;
    setRunToken((value) => value + 1);
  };

  const retryBox = async (deviceId) => {
    if (!sessionRef.current?.id || retrying) return;
    const priorResults = (retryOutcome?.physical?.results || [])
      .filter((item) => item.deviceId !== deviceId && Number.isFinite(item.relative))
      .map(({ deviceId: id, relative }) => ({ deviceId: id, relative }));
    const reference = priorResults[0];
    if (!reference) {
      setError('Nu există încă o boxă măsurată care să servească drept referință. Repetă măsurătoarea completă.');
      return;
    }
    setRetrying(deviceId);
    setError('');
    setPhase('measuring');
    try {
      const outcome = await retryPhoneBox({
        sessionId: sessionRef.current.id,
        zone: zoneRef.current,
        deviceId,
        priorResults,
        referenceDeviceId: reference.deviceId,
        roundStart: (sessionRef.current.round_index || 0) + 1,
        updateSession: (patch) => updateCalibrationSession(sessionRef.current.id, patch),
        testLevel,
        onProgress: (update) => {
          statusRef.current?.({
            ok: true,
            text: `Reîncerc boxa · seria ${update.round + 1}${update.detected != null ? ` · ${update.detected}/${update.signals} semnale` : ''}…`,
          });
        },
      });
      const measuredIds = new Set(outcome.results.map((item) => item.deviceId));
      const remaining = (retryOutcome?.unmeasured || []).filter((item) => !measuredIds.has(item.deviceId));
      const updated = {
        ...retryOutcome,
        ok: remaining.length === 0,
        applied: true,
        partial: remaining.length > 0,
        physical: { results: outcome.results, unmeasured: remaining },
        after: {
          ...retryOutcome?.after,
          results: outcome.results,
        },
        unmeasured: remaining,
      };
      setRetryOutcome(updated);
      await updateCalibrationSession(sessionRef.current.id, {
        status: 'capturing',
        phone_ready: false,
        result: sessionResult(updated),
      }).catch(() => {});
      if (remaining.length === 0) {
        await finishWithDetected(updated);
      } else {
        setPhase('retry');
        statusRef.current?.({
          ok: false,
          text: `Boxa a fost măsurată. Mai ${remaining.length === 1 ? 'rămâne o boxă' : `rămân ${remaining.length} boxe`} de reîncercat.`,
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setPhase('cancelled');
        return;
      }
      setError(err.message || 'Reîncercarea nu a reușit; sesiunea rămâne deschisă.');
      setPhase('retry');
      statusRef.current?.({ ok: false, text: err.message || 'Reîncercarea nu a reușit.' });
    } finally {
      setRetrying(null);
    }
  };

  const link = session?.code ? sessionLink(session.code) : '';
  const qr = session?.code ? <CalibrationQr value={link} className="h-44 w-44" /> : null;

  return (
    <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-heading text-sm font-semibold">
            <Smartphone className="h-4 w-4 text-primary" /> Aliniază cu telefonul
          </p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Telefonul stă în locul unde asculți și trimite doar momentele detectate. Nu primește control asupra playerului și nu vede biblioteca.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={phase === 'done' ? (result?.ok ? 'live' : 'warn') : phase === 'error' || phase === 'expired' || phase === 'retry' ? 'warn' : 'ready'} dot>
            {PHASE_TEXT[phase]}
          </StatusPill>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={close}>
            <X className="h-4 w-4" /> Închide
          </Button>
        </div>
      </div>

      {error && !session && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-3 py-2 text-xs leading-relaxed text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{error}</span>
        </p>
      )}

      {disabled ? null : (
        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <div className="space-y-2">
            {qr || (
              <div className="flex h-44 w-44 items-center justify-center rounded-2xl border border-border/60 bg-background/40 text-muted-foreground">
                <QrCode className="h-8 w-8" />
              </div>
            )}
            <p className="text-center text-[10px] text-muted-foreground">Scanează cu telefonul</p>
          </div>
          <div className="min-w-0 space-y-3">
            <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
              <p className="caps">Cod sesiune</p>
              <p className="mt-1 font-mono text-2xl tracking-[0.18em] text-primary">{session?.code || '········'}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="caps">Nivel semnal de test</p>
                <span className="font-mono text-xs text-primary">{Math.round(testLevel * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.12"
                max="0.6"
                step="0.02"
                value={testLevel}
                onChange={(event) => setTestLevel(Number(event.target.value))}
                className="mt-2 w-full accent-primary"
                aria-label="Nivel semnal de test"
              />
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Pornește moderat. Nu crește automat la maxim dacă boxa nu răspunde.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={copy} disabled={!session?.code}>
                <Copy className="h-3.5 w-3.5" /> {copied ? 'Copiat' : 'Copiază linkul'}
              </Button>
              <span className="text-[11px] text-muted-foreground">Sesiunea expiră în 10 minute.</span>
            </div>
            <ol className="space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <li>1. Autentifică telefonul în același cont SyncSonic.</li>
              <li>2. Deschide linkul, pune telefonul în locul unde asculți și apasă „Începe”.</li>
              <li>3. Ține telefonul nemișcat până se termină ambele ordini de măsurare.</li>
            </ol>
            {progress && phase === 'measuring' && (
              <p className="flex items-center gap-2 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {progress.phase === 'baseline' ? 'Starea actuală' : progress.phase === 'physical' ? 'Diferența fizică' : 'După compensare'}
                {progress.round != null ? ` · seria ${progress.round + 1}` : ''}
                {progress.spread != null ? ` · ${round(progress.spread)} ms` : ''}
              </p>
            )}
            {phase === 'retry' && retryOutcome && (
              <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-3 py-3">
                <p className="flex items-start gap-2 text-xs leading-relaxed text-warning">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Sesiunea rămâne deschisă. Boxele valide sunt păstrate; repetă doar boxele care nu au fost auzite.
                </p>
                <div className="space-y-1.5">
                  {(session?.outputs || []).map((output) => {
                    const unmeasured = (retryOutcome.unmeasured || []).find((item) => item.deviceId === output.deviceId);
                    const measured = (retryOutcome.physical?.results || []).some((item) => item.deviceId === output.deviceId);
                    return (
                      <div key={output.deviceId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-2">
                        <span className="min-w-0 flex-1 truncate text-xs">{output.label || 'Ieșire audio'}</span>
                        <StatusPill tone={unmeasured ? 'warn' : measured ? 'live' : 'neutral'} dot>
                          {unmeasured ? 'necesită reîncercare' : measured ? 'detectată' : 'necalibrată'}
                        </StatusPill>
                        {unmeasured && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 border-warning/40 text-warning"
                            onClick={() => retryBox(output.deviceId)}
                            disabled={!!retrying}
                          >
                            {retrying === output.deviceId ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            Repetă doar această boxă
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => finishWithDetected(retryOutcome)}
                    disabled={!!retrying || (retryOutcome.physical?.results || []).length < 2}
                  >
                    Continuă cu boxele detectate
                  </Button>
                  <Button size="sm" variant="outline" onClick={retryAll} disabled={!!retrying}>
                    Reia toate boxele
                  </Button>
                  <Button size="sm" variant="outline" onClick={close} disabled={!!retrying}>
                    Anulează
                  </Button>
                </div>
              </div>
            )}

            {result && (
              <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed ${result.ok ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                {result.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>
                  {result.ok
                    ? `${round(result.before.spread)} ms → ${round(result.after.spread)} ms · incertitudine ±${round(result.after.uncertainty)} ms.`
                    : result.reason}
                </span>
              </p>
            )}
            {error && (
              <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-3 py-2 text-xs leading-relaxed text-warning">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{error}</span>
              </p>
            )}
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Microfonul telefonului este eliberat la final, la anulare sau la închiderea sesiunii. Dacă boxele apar ca o singură ieșire, folosește testul de ascultare al grupului.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}