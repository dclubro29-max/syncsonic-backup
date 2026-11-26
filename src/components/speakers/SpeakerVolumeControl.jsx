import React from 'react';
import { useDj } from '@/lib/djContext';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX } from 'lucide-react';

export default function SpeakerVolumeControl({ speaker }) {
  const dj = useDj();
  const volume = dj.outputVolumes[speaker.deviceId] ?? 1;
  const disabled = !dj.setSinkSupported && !speaker.systemDefault;
  const Icon = volume === 0 ? VolumeX : Volume2;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" />Volum în aplicație</span>
        <span className="font-mono font-semibold tabular-nums text-foreground">{Math.round(volume * 100)}%</span>
      </div>
      <Slider aria-label={`Volum ${speaker.label}`} min={0} max={100} step={1}
        value={[Math.round(volume * 100)]} disabled={disabled}
        onValueChange={([value]) => dj.setOutputVolume(speaker.deviceId, value / 100)} />
      {disabled && <p className="text-[10px] text-muted-foreground">Browserul nu permite controlul separat al acestei ieșiri.</p>}
    </div>
  );
}