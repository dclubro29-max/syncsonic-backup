import React, { useState } from 'react';
import { AudioLines, Ear, Loader2, PlayCircle, Square } from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { Button } from '@/components/ui/button';
import { Surface, SurfaceHead } from '@/components/ui-kit/Surface';
import StatusPill from '@/components/ui-kit/StatusPill';
import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';
import { pushAudioEvent } from '@/lib/audioDiagnostics';

export default function BeatTestPanel() {
  const dj = useDj();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState({});
  const labelFor = (deviceId) => deviceId === SYSTEM_DEFAULT_ID
    ? 'Ieșirea sistemului'
    : dj.speakers.find((speaker) => speaker.deviceId === deviceId)?.label || 'Ieșire audio';

  const targets = [
    { id: 'all', label: 'Toate boxele' },
    { id: 'system', label: 'Ieșirea sistemului' },
    ...(dj.outputs || [])
      .filter((output) => output.deviceId !== SYSTEM_DEFAULT_ID)
      .map((output) => ({ id: output.deviceId, label: labelFor(output.deviceId) })),
  ];

  const start = async (target) => {
    setBusy(target);
    setError(null);
    try {
      await dj.testBeat(target);
    } catch (failure) {
      setError(failure.message || 'Beat-ul nu a pornit.');
    } finally {
      setBusy(null);
    }
  };

  const active = dj.beatTest?.active;
  const activeTarget = dj.beatTest?.target;
  const blocked = dj.emergencyPlayback || dj.stabilityMode;

  return (
    <Surface className="p-5 sm:p-6">
      <SurfaceHead
        icon={AudioLines}
        title="Testează cu un beat"
        hint="Beat generat în browser, fără fișiere. Trece prin volumul și întârzierea fiecărei ieșiri."
        action={<StatusPill tone={active ? 'live' : 'neutral'} dot>{active ? 'semnal trimis' : 'oprit'}</StatusPill>}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {targets.map((target) => {
          const isActive = active && activeTarget === target.id;
          return (
            <Button
              key={target.id}
              variant={isActive ? 'secondary' : 'outline'}
              size="sm"
              disabled={!!busy || dj.calibrationBusy || blocked}
              onClick={() => start(target.id)}
              className={isActive ? 'border-primary/40' : ''}
            >
              {busy === target.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {target.label}
            </Button>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => dj.stopTestBeat()} disabled={!active}>
          <Square className="h-4 w-4" /> Oprește
        </Button>
      </div>

      {blocked && <p className="mt-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-xs text-warning">Oprește modul de urgență sau stabilitate înainte de testul cu beat.</p>}
      {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/[0.07] px-4 py-3 text-xs text-destructive">{error}</p>}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <p className="caps">Player</p>
          <p className="mt-1 text-sm">{active ? `Trimite beat-ul către ${activeTarget === 'all' ? 'toate boxele' : activeTarget === 'system' ? 'ieșirea sistemului' : 'ieșirea aleasă'}.` : 'Nu trimite niciun semnal de test.'}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <p className="caps">Confirmare fizică</p>
          <p className="mt-1 text-sm text-muted-foreground">Progresul playerului nu dovedește că se aude. Confirmă prin ascultare sau cu microfonul, la aliniere.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="caps">Am auzit în</span>
        {targets.map((target) => (
          <button
            key={target.id}
            type="button"
            onClick={() => {
              const heard = !confirmed[target.id];
              setConfirmed((previous) => ({ ...previous, [target.id]: heard }));
              pushAudioEvent(heard ? 'heard' : 'unheard', `${target.label}: ${heard ? 'am auzit sunet' : 'confirmare retrasă'}`);
            }}
            className={`chip transition-colors ${confirmed[target.id] ? 'border-success/40 text-success' : ''}`}
            aria-pressed={!!confirmed[target.id]}
          >
            <Ear className="h-3 w-3" aria-hidden="true" />
            {target.label}
          </button>
        ))}
      </div>
    </Surface>
  );
}