import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Mic, Smartphone, TriangleAlert, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import StatusPill from '@/components/ui-kit/StatusPill';
import CalibrationLoginPrompt from '@/components/speakers/CalibrationLoginPrompt';
import { createPhoneCapture } from '@/lib/phoneCalibrationCapture';
import {
  closeCalibrationSession, isSessionExpired, readCalibrationSession, readCalibrationSessionById,
  updateCalibrationSession,
} from '@/lib/calibrationSession';

const CODE = new URLSearchParams(window.location.search).get('c') || '';

export default function CalibratePhone() {
  const [session, setSession] = useState(null);
  const [auth, setAuth] = useState('checking');
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [captureReady, setCaptureReady] = useState(false);
  const [detected, setDetected] = useState(0);
  const [currentRound, setCurrentRound] = useState(null);
  const [notice, setNotice] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const captureRef = useRef(null);
  const lastRoundRef = useRef(-1);
  const scanningRef = useRef(false);
  const closedRef = useRef(false);

  const stop = useCallback(() => {
    captureRef.current?.close();
    captureRef.current = null;
    setCaptureReady(false);
  }, []);

  const stopSession = useCallback(async () => {
    stop();
    if (session?.id) await closeCalibrationSession(session.id).catch(() => {});
    setPhase('cancelled');
  }, [session?.id, stop]);

  useEffect(() => {
    let active = true;
    closedRef.current = false;
    if (!CODE) {
      setPhase('error');
      setError('Lipsește codul sesiunii. Scanează din nou codul QR de pe laptop.');
      return () => {};
    }
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!active) return;
        if (!authed) {
          setAuth('no');
          setPhase('login');
          return;
        }
        setAuth('yes');
        const found = await readCalibrationSession(CODE);
        if (!active) return;
        if (!found) {
          setPhase('error');
          setError('Sesiunea nu există sau a fost ștearsă. Cere gazdei un cod nou.');
          return;
        }
        setSession(found);
        if (isSessionExpired(found)) { setPhase('expired'); return; }
        if (found.status === 'cancelled') { setPhase('cancelled'); return; }
        if (found.status === 'done') { setPhase('done'); return; }
        setPhase('idle');
      } catch (err) {
        if (active) {
          setPhase('error');
          setError(err.message || 'Sesiunea nu poate fi citită.');
        }
      }
    })();
    return () => {
      active = false;
      closedRef.current = true;
      captureRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const handler = () => stop();
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, [stop]);

  const start = async () => {
    if (!session?.id || captureRef.current) return;
    setPhase('starting');
    setError('');
    setNotice('');
    try {
      const capture = await createPhoneCapture();
      if (closedRef.current) { capture.close(); return; }
      captureRef.current = capture;
      // Confirmăm că telefonul primește efectiv probe înainte de prima serie.
      const probe = await capture.check(0.4);
      if (closedRef.current) { capture.close(); return; }
      setMicLevel(probe.rms || 0);
      setCaptureReady(true);
      const updated = await updateCalibrationSession(session.id, {
        capture_confirmed: true,
        status: 'capturing',
        capture_started_at: Date.now(),
        phone_ready: false,
        rounds: session.rounds || [],
      });
      setSession(updated);
      setPhase('waiting');
    } catch (err) {
      stop();
      setPhase('error');
      setError(err.name === 'NotAllowedError'
        ? 'Permite microfonul în browser, apoi apasă din nou „Începe”.'
        : err.message || 'Microfonul nu a putut fi deschis.');
    }
  };

  const runRound = useCallback(async (current) => {
    if (!captureRef.current || scanningRef.current) return;
    scanningRef.current = true;
    lastRoundRef.current = current.round_index;
    setCurrentRound(current.round_index);
    setDetected(0);
    setNotice('');
    setPhase('measuring');
    const signals = [...(current.signals || [])].sort((a, b) => a.at - b.at);
    const roundKey = signals.map((signal) => signal.id).join('|');
    const lastAt = signals[signals.length - 1]?.at || 900;
    const duration = Math.min(12, Math.max(3, (lastAt + 2600) / 1000));
    try {
      const scan = await captureRef.current.scan({
        duration,
        frequency: 900,
        onStart: () => {
          updateCalibrationSession(current.id, { phone_ready: true }).catch(() => {});
        },
      });
      const onsets = scan.onsets || [];
      const levels = scan.levels || [];
      const quality = levels.length ? Math.min(...levels) : 0;
      setDetected(onsets.length);
      const latest = await readCalibrationSessionById(current.id);
      // Un rezultat întârziat din altă serie nu are voie să fie atribuit boxei curente.
      if (latest.round_index !== current.round_index
        || (latest.signals || []).map((signal) => signal.id).join('|') !== roundKey) {
        setPhase('waiting');
        return;
      }
      const rounds = [
        ...(latest.rounds || []).filter((item) => item.round !== current.round_index),
        {
          round: current.round_index,
          round_key: roundKey,
          signal_ids: signals.map((signal) => signal.id),
          order: signals[0]?.order || '',
          onsets,
          levels,
          quality,
          sample_rate: captureRef.current?.sampleRate || 0,
          submitted_at: Date.now(),
        },
      ];
      await updateCalibrationSession(current.id, { rounds, phone_ready: false });
      setSession((previous) => (previous ? { ...previous, rounds } : previous));
      setPhase('waiting');
      if (onsets.length < signals.length) {
        setNotice(`Am auzit ${onsets.length} din ${signals.length} semnale. Gazda repetă doar boxele lipsă; ține telefonul nemișcat.`);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (/microfon|permisiune|oprit/i.test(err.message || '')) {
        setPhase('error');
        setError(err.message || 'Microfonul s-a oprit.');
        stop();
        return;
      }
      // O serie ratată nu închide sesiunea: raportăm seria incompletă, iar
      // gazda programează o nouă probă pentru boxele care lipsesc.
      try {
        const latest = await readCalibrationSessionById(current.id);
        if (latest.round_index === current.round_index) {
          const rounds = [
            ...(latest.rounds || []).filter((item) => item.round !== current.round_index),
            {
              round: current.round_index,
              round_key: roundKey,
              signal_ids: signals.map((signal) => signal.id),
              order: signals[0]?.order || '',
              onsets: [],
              levels: [],
              quality: 0,
              error: err.message || 'Seria nu a putut fi măsurată.',
              sample_rate: captureRef.current?.sampleRate || 0,
              submitted_at: Date.now(),
            },
          ];
          await updateCalibrationSession(current.id, { rounds, phone_ready: false });
          setSession((previous) => (previous ? { ...previous, rounds } : previous));
        }
      } catch (writeError) { /* hostul va reîncerca seria */ }
      setPhase('waiting');
      setNotice(err.message || 'Seria nu a putut fi măsurată. Gazda o repetă.');
    } finally {
      scanningRef.current = false;
    }
  }, [stop]);

  useEffect(() => {
    const id = session?.id;
    if (!id || !captureReady) return undefined;
    let active = true;
    const tick = async () => {
      try {
        const next = await readCalibrationSessionById(id);
        if (!active || !next) return;
        setSession(next);
        if (isSessionExpired(next)) { stop(); setPhase('expired'); return; }
        if (next.status === 'cancelled') { stop(); setPhase('cancelled'); return; }
        if (next.status === 'done') { stop(); setPhase('done'); return; }
        if (next.status === 'measuring'
          && Array.isArray(next.signals) && next.signals.length
          && Number(next.round_index) > lastRoundRef.current
          && !scanningRef.current) {
          runRound(next);
        }
      } catch (err) {
        if (active) {
          setPhase('error');
          setError(err.message || 'Sesiunea nu mai poate fi citită.');
        }
      }
    };
    tick();
    const timer = setInterval(tick, 700);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session?.id, captureReady, runRound, stop]);

  if (auth === 'no') return <CalibrationLoginPrompt code={CODE} />;

  const active = phase === 'waiting' || phase === 'capturing' || phase === 'measuring';
  const tone = phase === 'done' ? 'live' : phase === 'error' || phase === 'expired' || phase === 'cancelled' ? 'warn' : active ? 'ready' : 'neutral';
  const label = phase === 'idle' ? 'pregătit'
    : phase === 'starting' ? 'deschid microfonul'
      : phase === 'waiting' ? 'microfon activ'
        : phase === 'measuring' ? 'măsor'
          : phase === 'done' ? 'trimis'
            : phase === 'expired' ? 'expirat'
              : phase === 'cancelled' ? 'închis'
                : phase === 'error' ? 'oprit' : 'se încarcă';

  return (
    <div className="studio-ambient min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg flex-col justify-center">
        <div className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="caps">SyncSonic · calibrare</p>
              <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-semibold tracking-[-0.03em]">
                <Smartphone className="h-5 w-5 text-primary" /> Aliniază cu telefonul
              </h1>
            </div>
            <StatusPill tone={tone} dot>{label}</StatusPill>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Pune telefonul în locul unde asculți, la nivelul urechii, și apasă „Începe”. Telefonul ascultă semnalele și trimite doar momentele detectate. Nu controlează playerul și nu vede biblioteca.
          </p>

          {session?.code && (
            <p className="mt-3 inline-flex rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 font-mono text-sm tracking-[0.18em] text-primary">
              {session.code}
            </p>
          )}

          {phase === 'loading' && (
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Deschid sesiunea…
            </p>
          )}

          {phase === 'idle' && (
            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-info/25 bg-info/[0.06] px-4 py-3 text-xs leading-relaxed text-info">
                Nu atinge telefonul în timpul măsurătorii. Ține ecranul aprins până se termină ambele ordini.
              </div>
              <Button className="h-12 w-full gap-2 text-base" onClick={start}>
                <Mic className="h-5 w-5" /> Începe
              </Button>
            </div>
          )}

          {phase === 'starting' && (
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Deschid microfonul…
            </p>
          )}

          {phase === 'waiting' && (
            <div className="mt-6 space-y-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-xs leading-relaxed text-primary">
              <p className="flex items-center gap-2 font-medium"><Loader2 className="h-4 w-4 animate-spin" /> Aștept semnalele gazdei…</p>
              <p className="text-muted-foreground">Microfonul este activ și trimite probe. Nu închide ecranul și nu muta telefonul.</p>
              {micLevel > 0 && <p className="text-muted-foreground">Nivel microfon la deschidere: {Math.max(-90, Math.round(20 * Math.log10(micLevel)))} dB.</p>}
              {notice && <p className="text-warning">{notice}</p>}
            </div>
          )}

          {phase === 'measuring' && (
            <div className="mt-6 space-y-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-xs leading-relaxed text-primary">
              <p className="flex items-center gap-2 font-medium"><Mic className="h-4 w-4" /> Măsor… ține telefonul nemișcat.</p>
              <p className="text-muted-foreground">
                Seria {currentRound != null ? currentRound + 1 : 1} · am auzit {detected} {detected === 1 ? 'semnal' : 'semnale'}.
              </p>
              {notice && <p className="text-warning">{notice}</p>}
            </div>
          )}

          {(phase === 'waiting' || phase === 'measuring') && (
            <Button variant="outline" className="mt-3 w-full gap-2" onClick={stopSession}>
              <X className="h-4 w-4" /> Oprește testul
            </Button>
          )}

          {phase === 'done' && (
            <div className="mt-6 space-y-3 rounded-xl border border-success/30 bg-success/[0.06] px-4 py-3 text-sm leading-relaxed text-success">
              <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Măsurătoarea a fost trimisă.</p>
              <p className="text-muted-foreground">Microfonul a fost eliberat. Rezultatul și salvarea profilului apar pe laptop.</p>
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/"><ArrowLeft className="h-4 w-4" /> Înapoi la SyncSonic</Link>
              </Button>
            </div>
          )}

          {phase === 'cancelled' && (
            <div className="mt-6 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm leading-relaxed text-warning">
              Gazda a închis sesiunea. Microfonul este oprit.
            </div>
          )}

          {phase === 'expired' && (
            <div className="mt-6 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm leading-relaxed text-warning">
              Sesiunea a expirat. Cere gazdei un cod QR nou.
            </div>
          )}

          {phase === 'error' && (
            <div className="mt-6 space-y-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm leading-relaxed text-warning">
              <p className="flex items-start gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error || 'Măsurătoarea nu a reușit.'}</p>
              {session?.id && (
                <Button variant="outline" className="w-full" onClick={() => { stop(); setError(''); setPhase('idle'); }}>
                  Reîncearcă
                </Button>
              )}
            </div>
          )}

          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            Sesiunea expiră după 10 minute și poate fi închisă oricând de pe laptop. Dacă boxele apar ca o singură ieșire, gazda poate folosi testul de ascultare al grupului.
          </p>
        </div>
      </div>
    </div>
  );
}