import React from 'react';
import { Speaker, MonitorSpeaker, PhoneCall, Tv } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { isCommunicationsOutput, isHdmiOutput } from '@/lib/outputs';
import SpeakerVolumeControl from '@/components/speakers/SpeakerVolumeControl';

export default function SpeakerOutputRow({ sp, isOn, onToggle }) {
  const comms = isCommunicationsOutput(sp.label);
  const hdmi = !sp.systemDefault && isHdmiOutput(sp.label);
  const Icon = sp.systemDefault ? MonitorSpeaker : hdmi ? Tv : Speaker;
  return (
    <div className={`flex min-h-[64px] items-start justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors ${
      isOn ? 'border-primary/35 bg-primary/[0.06]' : 'border-border/60 bg-background/40 hover:border-foreground/20'}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            isOn ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/60 bg-surface-raised text-muted-foreground'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Label className="block break-words text-sm font-medium leading-snug">{sp.label || 'Dispozitiv audio'}</Label>
          <p className="mt-1 break-all font-mono text-[10px] leading-snug text-muted-foreground">
            {sp.systemDefault ? 'fără rutare explicită' : sp.deviceId}
          </p>
          {comms && <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
            <PhoneCall className="h-3 w-3" />Posibil destinată apelurilor
          </span>}
          {hdmi && <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">
            <Tv className="h-3 w-3" />Televizor prin HDMI
          </span>}
          <SpeakerVolumeControl speaker={sp} />
        </div>
      </div>
      <Switch
        aria-label={`Activează ${sp.label}`}
        className="mt-1 shrink-0"
        checked={isOn}
        onCheckedChange={() => onToggle(sp.deviceId)}
      />
    </div>
  );
}