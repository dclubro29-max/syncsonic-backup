import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MonitorSpeaker, Speaker } from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { Surface, SurfaceHead } from '@/components/ui-kit/Surface';
import StatusPill from '@/components/ui-kit/StatusPill';
import { SYSTEM_DEFAULT_ID, isCommunicationsOutput } from '@/lib/outputs';

const STATE = {
  active: { tone: 'live', label: 'activă', Icon: CheckCircle2 },
  starting: { tone: 'warn', label: 'pornește', Icon: Loader2 },
  failed: { tone: 'danger', label: 'refuzată', Icon: AlertTriangle },
};

export default function OutputStatusList() {
  const dj = useDj();
  const ids = dj.selectedSpeakers.length ? dj.selectedSpeakers : (dj.outputs || []).map((output) => output.deviceId);

  const labelFor = (deviceId) => {
    if (deviceId === SYSTEM_DEFAULT_ID) return 'Ieșirea sistemului';
    return dj.speakers.find((speaker) => speaker.deviceId === deviceId)?.label || 'Ieșire audio';
  };

  return (
    <Surface tone="quiet" className="p-5 sm:p-6">
      <SurfaceHead
        icon={Speaker}
        title="Starea ieșirilor"
        hint="Același mix master pe fiecare ieșire, cu volum și întârziere separate. Ce a pornit și ce lipsește."
        action={<StatusPill tone={dj.outputError ? 'danger' : dj.outputCount ? 'live' : 'neutral'} dot>{dj.outputError ? 'de rezolvat' : dj.outputCount ? 'pornite' : 'în așteptare'}</StatusPill>}
      />
      <div className="mt-4 space-y-2">
        {ids.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 px-4 py-4 text-xs text-muted-foreground">
            Nicio ieșire selectată. Alege „Ieșirea sistemului” sau deschide lista de boxe.
          </p>
        )}
        {ids.map((deviceId) => {
          const output = (dj.outputs || []).find((item) => item.deviceId === deviceId);
          const state = output ? STATE[output.state] || STATE.starting : STATE.failed;
          const Icon = deviceId === SYSTEM_DEFAULT_ID ? MonitorSpeaker : Speaker;
          const StateIcon = state.Icon;
          return (
            <div key={deviceId} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-raised text-muted-foreground">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{labelFor(deviceId)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {output
                    ? `întârziere ${output.delay} ms · volum ${Math.round((output.volume ?? 1) * 100)}%${output.band && output.band !== 'full' ? ` · bandă ${output.band}` : ''}`
                    : 'nu a fost creată: verifică legătura sau reselectează ieșirea'}
                </p>
                {output?.error && <p className="mt-1 text-[11px] text-destructive">{output.error}</p>}
                {isCommunicationsOutput(labelFor(deviceId)) && (
                  <p className="mt-1 text-[11px] text-warning">Posibil destinată apelurilor — compară cu testul de mai jos.</p>
                )}
              </div>
              <StatusPill tone={state.tone} dot={state.tone !== 'danger'} icon={StateIcon}>{state.label}</StatusPill>
            </div>
          );
        })}
        {dj.outputError && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.07] px-4 py-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {dj.outputError}
          </p>
        )}
      </div>
    </Surface>
  );
}