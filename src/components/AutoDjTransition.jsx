import React from "react";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft } from "lucide-react";

const STYLES = [
  { id: 'adaptive', label: 'Adaptiv', hint: 'Alege singur: crossfade lin pe zonele liniștite, trecere scurtă pe beat acolo unde muzica e densă. Fără efecte.' },
  { id: 'smooth', label: 'Lină', hint: 'Crossfade constant-power pe tot parcursul, fără niciun efect peste piese.' },
  { id: 'cut', label: 'Tăiere', hint: 'Trecere scurtă, pe beat, la finalul piesei care iese.' },
  { id: 'filter', label: 'Filtru', hint: 'Piesa care iese se închide treptat cu un filtru trece-jos, iar cea care intră se deschide dintr-un trece-sus — tranziție lungă, fără tăiere.' },
];

/** Stilul fiecărei tranziții făcute de Auto DJ. */
export default function AutoDjTransition({ value, onChange }) {
  const active = STYLES.find((style) => style.id === value) || STYLES[0];
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <Label className="flex items-center gap-1.5 text-xs font-medium">
        <ArrowRightLeft className="h-3.5 w-3.5" />
        Stilul tranziției
      </Label>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border p-1 sm:grid-cols-4">
        {STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => onChange(style.id)}
            className={`rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
              value === style.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{active.hint}</p>
    </div>
  );
}