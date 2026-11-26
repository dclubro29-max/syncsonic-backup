import React from "react";
import { Slider } from "@/components/ui/slider";
import { Volume2, Lock, ArrowLeftRight, Gauge } from "lucide-react";
import StatusPill from "@/components/ui-kit/StatusPill";

/**
 * Crossfader + volum master, pe un singur rând, ca să rămână vizibile lângă deckuri.
 * Când volumul e blocat, cursorul de master nu se mai poate mișca.
 */
export default function Crossfader({
  value,
  onChange,
  masterVolume,
  onMasterVolume,
  compact = false,
  locked = false,
}) {
  const percent = Math.round(value * 100);
  const master = Math.round(masterVolume * 100);

  if (compact) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/95 p-3 shadow-float backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="font-heading text-[10px] font-bold uppercase text-deck-a">A</span>
          <Slider
            value={[percent]}
            max={100}
            step={1}
            onValueChange={(v) => onChange(v[0] / 100)}
            aria-label="Crossfader"
            className="flex-1"
          />
          <span className="font-heading text-[10px] font-bold uppercase text-deck-b">B</span>
          <span className="mx-0.5 h-6 w-px shrink-0 bg-border" />
          {locked ? (
            <Lock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <Slider
            value={[master]}
            max={100}
            step={1}
            onValueChange={(v) => onMasterVolume(v[0] / 100)}
            disabled={locked}
            aria-label={locked ? "Volum master blocat" : "Volum master"}
            className="w-24"
          />
        </div>
      </div>
    );
  }

  return (
    <section className="panel px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="caps flex items-center gap-1.5">
              <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
              Crossfader
            </span>
            <span className="flex items-center gap-2">
              <StatusPill tone="deckA" className="px-2 py-0.5">A</StatusPill>
              <span className="num text-[11px] text-muted-foreground">{percent}%</span>
              <StatusPill tone="deckB" className="px-2 py-0.5">B</StatusPill>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-heading text-xs font-bold text-deck-a">A</span>
            <Slider
              value={[percent]}
              max={100}
              step={1}
              onValueChange={(v) => onChange(v[0] / 100)}
              aria-label="Crossfader A–B"
              className="flex-1"
            />
            <span className="font-heading text-xs font-bold text-deck-b">B</span>
          </div>
        </div>

        <div className="sm:w-60 sm:border-l sm:border-border/60 sm:pl-8">
          <div className="mb-3 flex items-center justify-between">
            <span className="caps flex items-center gap-1.5">
              <Gauge className="h-3 w-3" aria-hidden="true" />
              Master
            </span>
            <span className="num text-[11px] text-muted-foreground">
              {master}%{locked ? " · blocat" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {locked ? (
              <Lock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <Slider
              value={[master]}
              max={100}
              step={1}
              onValueChange={(v) => onMasterVolume(v[0] / 100)}
              disabled={locked}
              aria-label={locked ? "Volum master blocat — deblochează pentru reglare" : "Volum master"}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </section>
  );
}