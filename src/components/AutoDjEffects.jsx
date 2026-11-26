import React from "react";
import { useDj } from "@/lib/djContext";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Zap } from "lucide-react";
import { usePerformanceReadout } from '@/hooks/usePerformanceReadout';

/** Controls and live readings from the dedicated automatic audio stage. */
export default function AutoDjEffects() {
  const dj = useDj();
  const { config, setConfig, on, status } = dj.autoDj;
  const intensity = config.intensity ?? 0.6;
  const active = !!config.performance;
  const readout = usePerformanceReadout({ on, activeDeck: status.activeDeck ?? 0,
    mixing: status.phase === 'mixing', getDeckPerformance: dj.getDeckPerformance, getDeckAudio: dj.getDeckAudio });
  const live = readout.some((row) => row.playing &&
    (Math.abs(row.bass || 0) > 0.1 || (row.echo || 0) > 0.01 || (row.reverb || 0) > 0.01));
  const readings = readout.filter((row) => row.playing).map((row) => {
    const bass = (row.bass || 0) + (row.eqLow || 0);
    const level = 20 * Math.log10(Math.max(0.001, row.level ?? 1));
    return `Deck ${row.index === 0 ? 'A' : 'B'} · bass ${bass >= 0 ? '+' : ''}${bass.toFixed(1)} dB · nivel FX ${level.toFixed(1)} dB · ecou ${Math.round((row.echo || 0) * 100)}% · reverb ${Math.round((row.reverb || 0) * 100)}% · filtru ${Math.round(row.filterHz || 20000)} Hz · fader ${Math.round((row.mixGain ?? 1) * 100)}%`;
  });

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
      <div className="min-w-0 flex-1">
        <Label className="flex items-center gap-2 text-xs font-medium">
          <Zap className="h-3.5 w-3.5 text-primary" />
          Efecte automate
          {active && live && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </Label>
        {config.performanceMode === 'max' && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="chip">Fază beat-locked</span>
            <span className="chip">EQ crossover</span>
            <span className="chip">Selecție tempo + energie</span>
            {active && <span className="chip">Coregrafie build → drop</span>}
          </div>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {config.partyMax
            ? 'PARTY MAX aplică filtru, ecou și reverb de la pornire, apoi repetă build → drop cu pauze între accente. Efectele nu așteaptă analiza BPM.'
            : 'MAX ține faza bătăilor pe crossfade; ULTRA accentuează momentele detectate din piesă.'}
          {' '}Volumul master nu este schimbat.
          {on && <span className="mt-2 block font-mono text-primary">{readings.length ? readings.join(' | ') : 'Aștept redarea · încă nu este aplicat un efect audibil.'}</span>}
        </p>
        {active && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Intensitate</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {Math.round(intensity * 100)}%
              </span>
            </div>
            <Slider
              value={[intensity]}
              min={0.2}
              max={1}
              step={0.05}
              onValueChange={([v]) => setConfig({ intensity: v })}
            />
          </div>
        )}
      </div>
      <Switch checked={active} onCheckedChange={(v) => setConfig({ performance: v, transitionFx: v && config.performanceMode === 'max' })} />
    </div>
  );
}