import React from 'react';
import { MonitorSpeaker, Layers, Info, Users } from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { Surface, SurfaceHead } from '@/components/ui-kit/Surface';
import StatusPill from '@/components/ui-kit/StatusPill';
import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';

const MODES = [
  {
    id: 'system',
    icon: MonitorSpeaker,
    title: 'Ieșirea sistemului',
    hint: 'Telefonul sau laptopul alege ieșirea. Funcționează și cu un grup de boxe care apare ca o singură ieșire.',
  },
  {
    id: 'separate',
    icon: Layers,
    title: 'Ieșiri separate',
    hint: 'Fiecare boxă pe care browserul o expune separat, cu volum și întârziere proprii.',
  },
];

export default function OutputModeSelector() {
  const dj = useDj();
  const separateAvailable = dj.setSinkSupported && dj.speakers.some((speaker) => !speaker.systemDefault);
  const systemSelected = dj.selectedSpeakers.includes(SYSTEM_DEFAULT_ID);

  return (
    <Surface className="p-5 sm:p-6">
      <SurfaceHead
        icon={MonitorSpeaker}
        title="Unde se aude"
        hint="Alege întâi traseul, apoi boxele."
        action={
          <StatusPill tone={dj.outputCount ? 'live' : 'warn'} dot>
            {dj.outputCount
              ? `${dj.outputCount} ${dj.outputCount === 1 ? 'ieșire activă' : 'ieșiri active'}`
              : systemSelected ? 'Ieșirea sistemului' : 'niciuna activă'}
          </StatusPill>
        }
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const active = dj.outputMode === mode.id;
          const disabled = mode.id === 'separate' && !dj.setSinkSupported;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => dj.setOutputMode(mode.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active ? 'border-primary/40 bg-primary/[0.07]' : 'border-border/60 bg-background/40 hover:border-foreground/20'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <span className="flex items-center gap-2 font-heading text-sm font-semibold">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {mode.title}
              </span>
              <span className="mt-1.5 block text-[11px] leading-relaxed text-muted-foreground">{mode.hint}</span>
              {disabled && (
                <span className="mt-2 block text-[11px] text-warning">
                  Browserul nu expune ieșiri separate. Folosește Chrome sau Edge pe desktop ori Android.
                </span>
              )}
            </button>
          );
        })}
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <span className="flex items-center gap-2 font-heading text-sm font-semibold">
            <Users className="h-4 w-4" aria-hidden="true" />
            Grup de boxe compatibile
          </span>
          <span className="mt-1.5 block text-[11px] leading-relaxed text-muted-foreground">
            Conectează boxa principală și formează grupul în aplicația producătorului. Dacă sistemul îl vede ca o singură ieșire, alege „Ieșirea sistemului” și testează grupul ca întreg.
          </span>
        </div>
      </div>
      {dj.outputMode === 'separate' && !separateAvailable && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-xs leading-relaxed text-warning">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Sistemul vede boxele ca o singură ieșire. Alege „Ieșirea sistemului” și verifică prin ascultare; reglajele individuale nu apar și nu pot fi aplicate.
        </p>
      )}
    </Surface>
  );
}