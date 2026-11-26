import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Ear,
  Loader2,
  MonitorSpeaker,
  PlayCircle,
  RotateCcw,
  Speaker,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusPill from '@/components/ui-kit/StatusPill';
import OutputLevelMeter from '@/components/speakers/OutputLevelMeter';

const MAX_RETRIES = 4;

/**
 * O ieșire, pe înțelesul utilizatorului: selectată, pornită în browser,
 * confirmată la test sau încă neverificată. Semnalul din aplicație nu
 * dovedește boxa fizică; pentru asta există testul și confirmarea prin ascultare.
 */
export default function OutputTestRow({
  deviceId,
  label,
  output,
  systemDefault = false,
  connected = true,
  confirmedAt = 0,
  busy = false,
  onTest,
  onConfirm,
  onReject,
  onRetry,
  onSetVolume,
}) {
  const active = output?.state === 'active';
  const failed = output?.state === 'failed';
  const volume = output?.volume ?? 1;
  const muted = volume <= 0.001;
  const confirmed = !!confirmedAt && !failed;
  const retries = output?.retries || 0;
  const Icon = systemDefault ? MonitorSpeaker : Speaker;
  const VolumeIcon = muted ? VolumeX : Volume2;

  const reason = failed
    ? output?.error || 'Ruta nu a pornit.'
    : !connected || output?.disconnected
      ? 'Dispozitivul nu mai apare în listă. Reconectează-l sau reîmprospătează boxele.'
      : muted
        ? 'Volumul acestei ieșiri este 0% în aplicație.'
        : !active
          ? 'Redarea nu a pornit încă în browser.'
          : null;

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-raised text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-medium">{label}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone="neutral" dot>Selectată</StatusPill>
              {active ? <StatusPill tone="live" dot>Redare pornită în browser</StatusPill> : null}
              {confirmed ? (
                <StatusPill tone="live" icon={CheckCircle2}>Confirmată la test</StatusPill>
              ) : (
                <StatusPill tone={failed ? 'danger' : 'warn'} dot>Necesită verificare</StatusPill>
              )}
              {retries > 0 ? <StatusPill tone="warn">Reîncercări {retries}/{MAX_RETRIES}</StatusPill> : null}
            </div>
          </div>

          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <VolumeIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Volum aplicație {Math.round(volume * 100)}%
            {output?.delay ? ` · întârziere ${output.delay} ms` : ''}
            {output?.route === 'stability' ? ' · rută de stabilitate' : ''}
            {output?.route === 'emergency' ? ' · rută de urgență' : ''}
          </p>

          <OutputLevelMeter deviceId={deviceId} active={active} />

          {reason ? (
            <p className={`mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed ${failed ? 'text-destructive' : 'text-warning'}`}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {reason}
            </p>
          ) : null}

          {retries >= MAX_RETRIES && failed ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Reluarea automată este oprită după {MAX_RETRIES} încercări. Folosește „Reîncearcă doar această boxă”.</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => onTest(deviceId)}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
              {systemDefault ? 'Testează grupul' : 'Testează boxa'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-success/40 text-success"
              onClick={() => onConfirm(deviceId)}
            >
              <Ear className="h-3.5 w-3.5" />
              Am auzit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-destructive/40 text-destructive"
              onClick={() => onReject(deviceId)}
            >
              <Ear className="h-3.5 w-3.5" />
              N-am auzit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => onRetry(deviceId)}
              disabled={busy}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reîncearcă doar această boxă
            </Button>
            {muted ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-warning/40 text-warning"
                onClick={() => onSetVolume(deviceId, 1)}
              >
                <Volume2 className="h-3.5 w-3.5" />
                Volum 100%
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}