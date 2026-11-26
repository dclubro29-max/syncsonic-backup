import React, { useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, Copy, Play, RotateCcw, Square, TriangleAlert } from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';
import { Button } from '@/components/ui/button';
import { Surface, SurfaceHead } from '@/components/ui-kit/Surface';
import StatusPill from '@/components/ui-kit/StatusPill';
import { DIAGNOSTIC_LABELS, resetAudioDiagnostics, subscribeAudioEvents } from '@/lib/audioDiagnostics';
import MasterSignalDiagnostics from '@/components/speakers/MasterSignalDiagnostics';
import MasterPresetCompare from '@/components/speakers/MasterPresetCompare';

const SOAK_MS = 30 * 60 * 1000;
const clock = (ms) => new Date(ms).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const duration = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

export default function AudioDiagnosticsPanel() {
  const dj = useDj();
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({});
  const [soak, setSoak] = useState(null);
  const [copied, setCopied] = useState(false);
  const statsRef = useRef(dj.playbackProtection || {});
  statsRef.current = dj.playbackProtection || {};

  useEffect(() => subscribeAudioEvents((nextEvents, nextCounts) => {
    setEvents(nextEvents);
    setCounts(nextCounts);
  }), []);

  useEffect(() => {
    if (!soak || soak.result) return;
    const timer = setInterval(() => {
      setSoak((previous) => {
        if (!previous || previous.result) return previous;
        const elapsed = Date.now() - previous.startedAt;
        const stats = statsRef.current;
        if (elapsed < SOAK_MS) return { ...previous, elapsed };
        return {
          ...previous,
          elapsed,
          result: {
            partial: false,
            recoveries: (stats.recoveries || 0) - previous.baseline.recoveries,
            underruns: (stats.underruns || 0) - previous.baseline.underruns,
          },
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [soak?.startedAt, soak?.result]);

  const startSoak = () => {
    const stats = statsRef.current;
    setSoak({
      startedAt: Date.now(),
      elapsed: 0,
      baseline: { recoveries: stats.recoveries || 0, underruns: stats.underruns || 0 },
      checkpoints: [],
      result: null,
    });
  };

  const checkNow = () => {
    setSoak((previous) => {
      if (!previous) return previous;
      const stats = statsRef.current;
      const checkpoint = {
        at: Date.now(),
        elapsed: Date.now() - previous.startedAt,
        recoveries: (stats.recoveries || 0) - previous.baseline.recoveries,
        underruns: (stats.underruns || 0) - previous.baseline.underruns,
      };
      return { ...previous, checkpoints: [checkpoint, ...previous.checkpoints].slice(0, 6) };
    });
  };

  const stopSoak = () => {
    setSoak((previous) => {
      if (!previous || previous.result) return previous;
      const stats = statsRef.current;
      return {
        ...previous,
        result: {
          partial: true,
          recoveries: (stats.recoveries || 0) - previous.baseline.recoveries,
          underruns: (stats.underruns || 0) - previous.baseline.underruns,
        },
      };
    });
  };

  const labelFor = (deviceId) => deviceId === SYSTEM_DEFAULT_ID
    ? 'Ieșirea sistemului'
    : dj.speakers.find((speaker) => speaker.deviceId === deviceId)?.label || 'Ieșire audio';

  const summary = [
    { label: 'Așteptare / pauze', value: (counts.waiting || 0) + (counts.stalled || 0) },
    { label: 'Erori', value: counts.error || 0 },
    { label: 'Schimbări de ieșire', value: counts.output || 0 },
    { label: 'Reluări', value: counts.recovery || 0 },
    { label: 'Goluri de randare', value: counts.underrun || 0 },
    { label: 'Confirmări fizice', value: counts.heard || 0 },
  ];

  const copyReport = async () => {
    const report = [
      'SyncSonic — rezumat diagnostic audio',
      `Data: ${new Date().toLocaleString('ro-RO')}`,
      `Player: ${dj.isPlaybackActive() ? 'trimite semnal audio' : 'oprit'}${dj.beatTest?.active ? ' · test cu beat activ' : ''}`,
      `Ieșiri active: ${dj.outputCount}`,
      ...(dj.outputs || []).map((output) =>
        `- ${labelFor(output.deviceId)}: ${output.state}, ${output.delay} ms, volum ${Math.round((output.volume ?? 1) * 100)}%`),
      `Evenimente: ${summary.map((item) => `${item.label} ${item.value}`).join(' · ')}`,
      ...events.slice(0, 14).map((event) =>
        `${clock(event.at)} ${DIAGNOSTIC_LABELS[event.kind] || event.kind}: ${event.message}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      /* clipboard refuzat — utilizatorul poate selecta textul manual */
    }
  };

  return (
    <Surface tone="quiet" className="p-5 sm:p-6">
      <SurfaceHead
        icon={Activity}
        title="Diagnostic audio"
        hint="Pauze, erori, schimbări de ieșire și reluări. Doar schimbări, nu eșantioane continue."
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => dj.setStabilityMode(!dj.stabilityMode)}>
              {dj.stabilityMode ? 'Revino la interfața completă' : 'Compară în mod stabilitate'}
            </Button>
            <Button size="sm" variant="ghost" onClick={copyReport}><Copy className="h-4 w-4" /> {copied ? 'Copiat' : 'Copiază rezumatul'}</Button>
            <Button size="sm" variant="ghost" onClick={resetAudioDiagnostics}><RotateCcw className="h-4 w-4" /> Resetează</Button>
          </div>
        }
      />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-mono text-lg tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        <MasterSignalDiagnostics />
        <MasterPresetCompare />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <p className="caps">Player</p>
          <p className="mt-1 text-sm">{dj.isPlaybackActive() || dj.beatTest?.active ? 'Trimite semnal audio.' : 'Oprit.'}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <p className="caps">Confirmare fizică</p>
          <p className="mt-1 text-sm text-muted-foreground">Playerul poate avansa fără ca sunetul să se audă. Confirmă în testul cu beat, la „Am auzit în”.</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Analiza BPM rulează off-thread, iar modul stabilitate oprește analiza, spectrul și actualizările continue. Folosește comparația de mai sus dacă bănuiești că vizualizarea încarcă redarea.
      </p>
      <div className="mt-4 space-y-1.5">
        <p className="caps">Ultimele evenimente</p>
        {events.length === 0 && <p className="text-xs text-muted-foreground">Niciun eveniment încă. Pornește o redare sau un test.</p>}
        {events.slice(0, 8).map((event) => (
          <div key={event.id} className="flex items-start gap-2 text-[11px]">
            <span className="font-mono text-muted-foreground">{clock(event.at)}</span>
            <span className="w-28 shrink-0 text-muted-foreground">{DIAGNOSTIC_LABELS[event.kind] || event.kind}</span>
            <span className="min-w-0 flex-1 break-words">{event.message}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="caps">Test de continuitate · 30 min</p>
            <p className="mt-1 text-xs text-muted-foreground">Ținta: 30 de minute fără întreruperi audibile, cu boxele selectate.</p>
          </div>
          {!soak ? (
            <Button size="sm" className="gap-2" onClick={startSoak}><Play className="h-4 w-4" /> Începe testul</Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={checkNow}>Verifică acum</Button>
              {!soak.result && <Button size="sm" variant="ghost" onClick={stopSoak}><Square className="h-4 w-4" /> Oprește</Button>}
            </div>
          )}
        </div>
        {soak && (
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={soak.result ? (soak.result.partial ? 'warn' : soak.result.recoveries + soak.result.underruns === 0 ? 'live' : 'danger') : 'ready'} dot>
                {duration(soak.elapsed)} / 30:00
              </StatusPill>
              {soak.result && (
                <span className="flex items-center gap-1.5">
                  {soak.result.recoveries + soak.result.underruns === 0
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <TriangleAlert className="h-4 w-4 text-warning" />}
                  {soak.result.partial ? 'Test oprit' : 'Test încheiat'}: {soak.result.recoveries} reluări, {soak.result.underruns} goluri de randare.
                </span>
              )}
            </div>
            {soak.checkpoints.map((checkpoint) => (
              <p key={checkpoint.at} className="text-muted-foreground">
                La {duration(checkpoint.elapsed)}: {checkpoint.recoveries} reluări, {checkpoint.underruns} goluri.
              </p>
            ))}
            <p className="text-[11px] leading-relaxed text-warning">
              Testul măsoară doar ce raportează browserul. Confirmarea că sunetul se aude fizic în boxe necesită echipamente reale și ascultare.
            </p>
          </div>
        )}
      </div>
    </Surface>
  );
}