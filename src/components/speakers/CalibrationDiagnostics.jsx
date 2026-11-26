import React, { useEffect, useState } from 'react';
import {
  Ear, Loader2, Music2, PlayCircle, RotateCcw, SlidersHorizontal, Speaker, TriangleAlert,
} from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { Button } from '@/components/ui/button';
import StatusPill from '@/components/ui-kit/StatusPill';
import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';

const round = (value) => Math.round(value * 10) / 10;

function LevelBar({ label, level }) {
  const peak = Math.max(0, Math.min(1, level?.peak || 0));
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{peak ? `${Math.round(peak * 100)}%` : '—'}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150"
          style={{ width: `${Math.round(peak * 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Diagnostic pe fiecare ieșire: aceeași ramură audibilă primește fie o mostră
 * de muzică, fie semnalul de test. Nivelul arată semnalul din aplicație, nu
 * dovedește că boxa fizică a emis sunet.
 */
export default function CalibrationDiagnostics() {
  const dj = useDj();
  const [level, setLevel] = useState(0.32);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  const [readings, setReadings] = useState({});

  const outputs = dj.outputs || [];

  useEffect(() => {
    if (!outputs.length) return undefined;
    const timer = setInterval(() => {
      const next = {};
      outputs.forEach((output) => {
        const reading = dj.getOutputDiagnostics?.(output.deviceId);
        if (reading) next[output.deviceId] = reading;
      });
      setReadings(next);
    }, 350);
    return () => clearInterval(timer);
  }, [outputs.map((output) => output.deviceId).join('|'), dj.getOutputDiagnostics]);

  const labelFor = (deviceId) => deviceId === SYSTEM_DEFAULT_ID
    ? 'Ieșirea sistemului'
    : dj.speakers.find((speaker) => speaker.deviceId === deviceId)?.label
      || outputs.find((output) => output.deviceId === deviceId)?.label
      || 'Ieșire audio';

  const run = async (deviceId, kind) => {
    setBusy(`${deviceId}:${kind}`);
    setNotice('');
    try {
      if (kind === 'music') {
        await dj.playOutputSample?.(deviceId, { level, ms: 1800 });
        setNotice(`Mostră de muzică trimisă către ${labelFor(deviceId)} pe ramura audibilă.`);
      } else {
        await dj.playTestTone?.(deviceId, 420, { level });
        setNotice(`Semnal de test trimis către ${labelFor(deviceId)}. Ascultă dacă bipul iese din boxă.`);
      }
    } catch (error) {
      setNotice(error.message || 'Semnalul nu a putut fi trimis.');
    } finally {
      setBusy(null);
    }
  };

  const retry = async (deviceId) => {
    setBusy(`${deviceId}:retry`);
    setNotice('');
    try {
      await dj.retryOutput?.(deviceId);
      setNotice(`${labelFor(deviceId)} a fost reîncercată fără să oprească celelalte ieșiri.`);
    } catch (error) {
      setNotice(error.message || 'Boxa nu a putut fi reîncercată.');
    } finally {
      setBusy(null);
    }
  };

  if (!outputs.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 px-4 py-4 text-xs leading-relaxed text-muted-foreground">
        Nicio ieșire activă. Alege boxele înainte de diagnostic.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-heading text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Diagnostic pe fiecare ieșire
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Aceleași două teste pe aceeași ramură. Începe cu boxa singură, apoi verifică în grup.
          </p>
        </div>
        <div className="min-w-[150px]">
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>Nivel probă</span>
            <span className="font-mono text-primary">{Math.round(level * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.12"
            max="0.6"
            step="0.02"
            value={level}
            onChange={(event) => setLevel(Number(event.target.value))}
            className="mt-1 w-full accent-primary"
            aria-label="Nivelul probei de diagnostic"
          />
        </div>
      </div>

      {outputs.map((output) => {
        const reading = readings[output.deviceId] || {};
        const failed = output.state === 'failed' || reading.failed;
        const active = output.state === 'active' && !failed;
        return (
          <div key={output.deviceId} className="rounded-xl border border-border/60 bg-background/40 px-3.5 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-raised text-primary">
                  <Speaker className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{labelFor(output.deviceId)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    rută {reading.route || output.route || 'normal'} · {round(reading.delay ?? output.delay ?? 0)} ms · volum {Math.round((reading.volume ?? output.volume ?? 1) * 100)}%
                    {reading.muted ? ' · mut' : ''}
                  </p>
                </div>
              </div>
              <StatusPill tone={failed ? 'danger' : active ? 'live' : 'warn'} dot>
                {failed ? 'refuzată' : active ? 'pornită' : 'pornește'}
              </StatusPill>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <LevelBar label="Intrare ramură" level={reading.branch} />
              <LevelBar label="Ieșire după volum" level={reading.output} />
            </div>

            {failed && reading.error ? (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {reading.error}
              </p>
            ) : null}

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => run(output.deviceId, 'music')}
                disabled={!!busy || failed || dj.calibrationBusy}
              >
                {busy === `${output.deviceId}:music` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Music2 className="h-3.5 w-3.5" />}
                Ascultă o mostră de muzică
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => run(output.deviceId, 'tone')}
                disabled={!!busy || failed || dj.calibrationBusy}
              >
                {busy === `${output.deviceId}:tone` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                Ascultă semnalul de test
              </Button>
              {failed ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() => retry(output.deviceId)}
                  disabled={!!busy}
                >
                  {busy === `${output.deviceId}:retry` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Reîncearcă doar această boxă
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}

      {notice && (
        <p className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Ear className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {notice}
        </p>
      )}
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Nivelul din aplicație nu dovedește că boxa a emis sunet. Dacă muzica se aude și bipul nu, problema este pe ramura de test; dacă bipul se aude dar telefonul nu îl detectează, problema este la microfon sau la detector.
      </p>
    </div>
  );
}