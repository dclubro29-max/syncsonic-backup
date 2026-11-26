import React from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

const FX = [
  { key: "echo", label: "ECHO", hint: "Repetiție întârziată, cu revenire" },
  { key: "reverb", label: "REVERB", hint: "Spațiu, cameră" },
  { key: "filter", label: "FILTRU", hint: "Stânga = bass (LP) · Dreapta = subțire (HP)" },
  { key: "karaoke", label: "KARAOKE", hint: "Scoate vocea din centru și lasă instrumentalul" },
];

/** Efecte reale pe deck: echo, reverb și filtru, cu intensitate și reset. */
export default function EffectsPanel({ fx, disabled, onChange, onReset }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">EFECTE</span>
        <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" onClick={onReset} disabled={disabled}>
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>
      {FX.map((f) => {
        const value = f.key === "filter" ? Math.round(fx.filter * 100) : Math.round(fx[f.key] * 100);
        const min = f.key === "filter" ? -100 : 0;
        return (
          <div key={f.key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-[10px] font-semibold tracking-wider text-muted-foreground">{f.label}</span>
            <Slider
              value={[value]}
              min={min}
              max={100}
              step={1}
              disabled={disabled}
              onValueChange={(v) => onChange(f.key, f.key === "filter" ? v[0] / 100 : v[0] / 100)}
              className="flex-1"
            />
            <span className="w-9 text-right text-[10px] tabular-nums text-muted-foreground">{value}</span>
          </div>
        );
      })}
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        La 0 efectul este complet scos din traseu, nu doar atenuat.
      </p>
    </div>
  );
}